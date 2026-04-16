const { google } = require('googleapis');
const Ticket = require('../models/Ticket.model');
const User = require('../models/User.model');
const { calculatePriorityScore, calculateSLADeadline, calculateResponseDeadline } = require('./priority.service');
const { emitToRole } = require('../config/socket');

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
  if (text.match(/\b(laptop|computer|network|vpn|software|hardware|printer|wifi|password|email|it|system)\b/)) return 'IT';
  if (text.match(/\b(salary|payroll|leave|hr|onboarding|offer|contract|attendance)\b/)) return 'HR';
  if (text.match(/\b(invoice|payment|reimbursement|expense|budget|finance|billing)\b/)) return 'Finance';
  if (text.match(/\b(office|facilities|parking|access card|badge)\b/)) return 'Admin';
  return 'Other';
};

const pollEmails = async () => {
  try {
    const gmail = getGmailClient();

    // Get unread emails sent to support address
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread to:me -from:noreply',
      maxResults: 20
    });

    const messages = response.data.messages || [];
    if (messages.length === 0) return;

    console.log(`📧 Found ${messages.length} unread emails to process`);

    for (const msg of messages) {
      try {
        // Check if already processed (by messageId)
        const existing = await Ticket.findOne({ 'emailSource.messageId': msg.id });
        if (existing) continue;

        const fullMsg = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
        const { payload, snippet } = fullMsg.data;
        const headers = payload?.headers || [];

        const from = getHeaderValue(headers, 'from');
        const subject = getHeaderValue(headers, 'subject') || 'No Subject';
        const date = getHeaderValue(headers, 'date');
        const threadId = fullMsg.data.threadId;

        // Extract sender email
        const emailMatch = from.match(/<(.+)>/) || [null, from];
        const senderEmail = emailMatch[1]?.trim();

        // Find user by email
        let senderUser = await User.findOne({ email: senderEmail?.toLowerCase() });
        if (!senderUser) {
          // Mark as read and skip - only registered users
          await gmail.users.messages.modify({
            userId: 'me',
            id: msg.id,
            resource: { removeLabelIds: ['UNREAD'] }
          });
          continue;
        }

        const body = extractEmailBody(payload);
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
          description: body.substring(0, 5000) || snippet,
          category,
          priority: scoring.priority,
          priorityScore: scoring.finalScore,
          prioritySource: 'auto',
          scoreBreakdown: scoring.breakdown,
          impactScope: 'just_me',
          urgencyLevel: 'flexible',
          createdBy: senderUser._id,
          status: 'open',
          sla: {
            deadline: slaDeadline,
            responseDeadline,
            breached: false
          },
          emailSource: {
            messageId: msg.id,
            from: senderEmail,
            receivedAt: date ? new Date(date) : new Date(),
            threadId
          }
        });

        // Mark as read in Gmail
        await gmail.users.messages.modify({
          userId: 'me',
          id: msg.id,
          resource: { removeLabelIds: ['UNREAD'] }
        });

        console.log(`✅ Email → Ticket: ${ticket.ticketId} from ${senderEmail}`);

        // Notify admins/agents in real-time
        emitToRole('admin', 'ticket_created', {
          ticketId: ticket._id,
          ticket: ticket.ticketId,
          title: ticket.title,
          source: 'email'
        });
        emitToRole('support_agent', 'ticket_created', {
          ticketId: ticket._id,
          ticket: ticket.ticketId,
          title: ticket.title,
          source: 'email'
        });

      } catch (msgErr) {
        console.error(`Error processing email ${msg.id}:`, msgErr.message);
      }
    }
  } catch (err) {
    console.error('Email polling error:', err.message);
  }
};

const startEmailPoller = () => {
  if (pollerInterval) return;
  // Poll immediately, then on interval
  pollEmails();
  const interval = parseInt(process.env.EMAIL_POLL_INTERVAL) || 300000; // 5 min default
  pollerInterval = setInterval(pollEmails, interval);
  console.log(`📧 Email poller running every ${interval / 60000} minutes`);
};

const stopEmailPoller = () => {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
  }
};

module.exports = { startEmailPoller, stopEmailPoller, pollEmails };
