const { google } = require('googleapis');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const Ticket = require('../models/Ticket.model');
const User = require('../models/User.model');
const { calculatePriorityScore, calculateSLADeadline, calculateResponseDeadline } = require('./priority.service');
const { emitToRole, emitToDepartment } = require('../config/socket');
const { autoAssignTicket, incrementWorkload } = require('./assignment.service');
const { notifyTicketAssigned } = require('./notification.service');

let pollerInterval = null;

const getGmailClient = () => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth: oauth2Client });
};

const extractEmailBody = (payload) => {
  if (!payload) return '';
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
    }
  }
  return '';
};

const getHeaderValue = (headers, name) => {
  const header = headers?.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || '';
};

const detectCategoryFromEmail = (subject, body) => {
  const text = `${subject} ${body}`.toLowerCase();
  if (text.match(/\b(laptop|computer|network|vpn|software|hardware|printer|wifi|password|email|it|system|keyboard|mouse|monitor|screen|crash|os|windows|mac|update|bug|app|login|display|reset|access|outlook|teams|internet|browser|chrome)\b/)) return 'IT';
  if (text.match(/\b(salary|payroll|leave|hr|onboarding|offer|contract|attendance)\b/)) return 'HR';
  if (text.match(/\b(invoice|payment|reimbursement|expense|budget|finance|billing)\b/)) return 'Finance';
  if (text.match(/\b(office|facilities|parking|access card|badge)\b/)) return 'Admin';
  return 'Other';
};

const isIgnoredEmail = (sender, subject) => {
  const ignoredDomains = ['google.com', 'linkedin.com', 'facebook.com', 'twitter.com', 'github.com', 'noreply', 'no-reply', 'mailer-daemon'];
  const ignoredKeywords = ['delivered', 'delivery status', 'undeliverable', 'out of office', 'auto-reply', 'security alert', 'new login', 'verify your email', 'unsubscribe', '2-step verification', 'password changed', 'account recovery', 'verification code'];
  
  const senderLower = (sender || '').toLowerCase();
  const subjectLower = (subject || '').toLowerCase();

  // Check domains
  if (ignoredDomains.some(domain => senderLower.includes(domain))) return true;
  
  // Check typical auto-generated keywords in subject
  if (ignoredKeywords.some(kw => subjectLower.includes(kw))) return true;

  // Filter out short meaningless subjects if needed, but above covers most system emails
  return false;
};

const { sendTicketConfirmation } = require('./email.service');

/**
 * Creates a ticket from email data
 */
const createTicketFromEmail = async (emailData) => {
  const { subject, body, senderEmail, messageId, threadId, date, source } = emailData;

  // Find user by email
  let senderUser = await User.findOne({ email: senderEmail?.toLowerCase() });
  
  if (!senderUser) {
    console.log(`👤 Creating new guest user for email: ${senderEmail}`);
    // Create a guest user if they don't exist
    senderUser = await User.create({
      name: senderEmail.split('@')[0],
      email: senderEmail.toLowerCase(),
      password: require('crypto').randomBytes(8).toString('hex'), // Random password
      role: 'employee',
      department: 'Other',
      isGuest: true
    });
  }

  const category = detectCategoryFromEmail(subject, body);

  // Calculate priority
  const scoring = calculatePriorityScore({
    impactScope: 'just_me',
    urgencyLevel: 'flexible',
    role: senderUser.role,
    title: subject,
    description: body,
    createdAt: new Date()
  });

  const slaDeadline = calculateSLADeadline(scoring.priority);
  const responseDeadline = calculateResponseDeadline(scoring.priority);

  // Create ticket
  const ticket = await Ticket.create({
    title: subject.replace(/^(re:|fwd?:)\s*/i, '').trim().substring(0, 200),
    description: body.substring(0, 5000) || 'No content provided',
    category,
    priority: scoring.priority,
    priorityScore: scoring.finalScore,
    prioritySource: 'auto',
    scoreBreakdown: scoring.breakdown,
    impactScope: 'just_me',
    urgencyLevel: 'flexible',
    createdBy: senderUser._id,
    status: 'open',
    preferredContact: 'email',
    firstResponseAt: new Date(),
    sla: {
      deadline: slaDeadline,
      responseDeadline,
      breached: false
    },
    emailSource: {
      messageId: messageId,
      from: senderEmail,
      receivedAt: date ? new Date(date) : new Date(),
      threadId: threadId || messageId
    }
  });

  console.log(`✅ ${source} → Ticket: ${ticket.ticketId} from ${senderEmail}`);

  // Send confirmation email back to user
  sendTicketConfirmation({
    to: senderEmail,
    name: senderUser.name,
    ticket: ticket
  });

  // Auto-assign
  const agent = await autoAssignTicket(ticket);
  if (agent) {
    ticket.assignedTo = agent._id;
    ticket.assignedAt = new Date();
    ticket.assignedBy = null; // system
    ticket.autoAssigned = true;
    ticket.status = 'assigned';
    if (!ticket.statusHistory) ticket.statusHistory = [];
    ticket.statusHistory.push({ from: 'open', to: 'assigned', reason: 'Auto-assigned by system' });
    await ticket.save();

    await incrementWorkload(agent._id);
    try { await notifyTicketAssigned(ticket, agent, senderUser); } catch(e) {}
  }

  const populatedTicket = await Ticket.findById(ticket._id).populate('createdBy', 'name email avatar department').lean();

  // Notify admins/agents in real-time
  const notificationData = {
    ticketId: ticket._id,
    ticket: populatedTicket,
    title: ticket.title,
    category: ticket.category,
    source: 'email'
  };
  
  // Notify system admins
  emitToRole('admin', 'ticket_created', notificationData);
  
  // Notify departmental admins/agents
  if (ticket.category) {
    emitToDepartment(ticket.category, 'ticket_created', notificationData);
  }
  
  // Also notify support agents role for general visibility
  emitToRole('support_agent', 'ticket_created', notificationData);

  return ticket;
};

/**
 * Poll via Gmail API
 */
const pollGmail = async () => {
  const gmail = getGmailClient();
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread in:inbox category:primary -from:noreply -from:no-reply@ -from:mailer-daemon',
    maxResults: 20
  });

  const messages = response.data.messages || [];
  if (messages.length === 0) return;

  console.log(`📧 Gmail: Found ${messages.length} unread emails`);

  for (const msg of messages) {
    try {
      const existing = await Ticket.findOne({ 'emailSource.messageId': msg.id });
      if (existing) {
        // Just mark as read if it exists but is still unread in Gmail
        await gmail.users.messages.modify({ userId: 'me', id: msg.id, resource: { removeLabelIds: ['UNREAD'] } });
        continue;
      }

      const fullMsg = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
      const { payload, snippet } = fullMsg.data;
      const headers = payload?.headers || [];

      const from = getHeaderValue(headers, 'from');
      const subject = getHeaderValue(headers, 'subject') || 'No Subject';
      const date = getHeaderValue(headers, 'date');
      const threadId = fullMsg.data.threadId;

      const emailMatch = from.match(/<(.+)>/) || [null, from];
      const senderEmail = emailMatch[1]?.trim();
      
      // Ignore automated system emails
      if (isIgnoredEmail(senderEmail, subject)) {
        await gmail.users.messages.modify({ userId: 'me', id: msg.id, resource: { removeLabelIds: ['UNREAD'] } });
        console.log(`🚫 Ignored automated/system email from: ${senderEmail}`);
        continue;
      }

      const body = extractEmailBody(payload) || snippet;

      await createTicketFromEmail({
        subject,
        body,
        senderEmail,
        messageId: msg.id,
        threadId,
        date,
        source: 'Gmail'
      });

      // Mark as read in Gmail
      await gmail.users.messages.modify({
        userId: 'me',
        id: msg.id,
        resource: { removeLabelIds: ['UNREAD'] }
      });

    } catch (err) {
      console.error(`❌ Gmail Message Error (${msg.id}):`, err.message);
    }
  }
};

/**
 * Poll via IMAP
 */
const pollImap = async () => {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT) || 993,
    secure: process.env.IMAP_SECURE === 'true',
    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASSWORD
    },
    logger: false,
    connectionTimeout: 60000,
    greetingTimeout: 60000,
    socketTimeout: 60000
  });

  client.on('error', err => {
    console.error('⚠️ IMAP Client Error:', err.message);
  });

  try {
    await client.connect();
    let lock = await client.getMailboxLock('INBOX');
    try {
      // Find all unread messages
      const messages = await client.search({ seen: false });
      
      if (messages.length === 0) return;
      console.log(`📧 IMAP: Found ${messages.length} unread emails`);

      for (const uid of messages) {
        try {
          // Fetch message source
          const message = await client.fetchOne(uid, { source: true, envelope: true });
          
          // Check if already processed
          const messageId = message.envelope.messageId;
          const existing = await Ticket.findOne({ 'emailSource.messageId': messageId });
          
          if (existing) {
            // Already processed, just ensure it's marked as seen
            await client.messageFlagsAdd(uid, ['\\Seen']);
            continue;
          }

          // Parse message
          const parsed = await simpleParser(message.source);
          
          await createTicketFromEmail({
            subject: parsed.subject || 'No Subject',
            body: parsed.text || parsed.textAsHtml || 'No content',
            senderEmail: parsed.from.value[0].address,
            messageId: messageId,
            threadId: messageId, // IMAP doesn't have a direct threadId like Gmail
            date: parsed.date,
            source: 'IMAP'
          });

          // Mark as seen
          await client.messageFlagsAdd(uid, ['\\Seen']);

        } catch (msgErr) {
          console.error(`❌ IMAP Message Error (UID ${uid}):`, msgErr.message);
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    console.error('❌ IMAP Connection Error:', err);
    try {
      if (client.usable) await client.logout();
    } catch(e) {}
  }
};

const pollEmails = async () => {
  let method = process.env.EMAIL_POLLING_METHOD || 'IMAP';
  
  // If method is SMTP but IMAP credentials exist, use IMAP for polling
  if (method === 'SMTP' || method === 'IMAP') {
    await pollImap();
  } else if (method === 'GMAIL') {
    await pollGmail();
  }
};

const startEmailPoller = () => {
  if (pollerInterval) return;
  
  // Run immediately
  pollEmails().catch(err => console.error('❌ Poller error (initial):', err.message));
  
  const interval = parseInt(process.env.EMAIL_POLL_INTERVAL) || 300000;
  pollerInterval = setInterval(() => {
    pollEmails().catch(err => console.error('❌ Poller error (interval):', err.message));
  }, interval);
  
  const method = process.env.EMAIL_POLLING_METHOD || 'IMAP';
  console.log(`📧 Email poller running every ${interval / 60000} minute(s)`);
};

const stopEmailPoller = () => {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
  }
};

module.exports = { startEmailPoller, stopEmailPoller, pollEmails };
