const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return transporter;
};

const sendOtpEmail = async ({ to, otp }) => {
  const transport = getTransporter();
  if (!transport) throw new Error('Email transporter not available');
  await transport.sendMail({
    from: `"TicketDesk" <${process.env.FROM_EMAIL || process.env.SUPPORT_EMAIL}>`,
    to,
    subject: `${otp} is your TicketDesk login code`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <div style="background: #1E40AF; color: white; padding: 24px 30px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">Your login code</h2>
          </div>
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef; text-align: center;">
            <p style="color: #6c757d; margin-bottom: 24px;">Use this code to sign in to TicketDesk. It expires in <strong>10 minutes</strong>.</p>
            <div style="background: white; border: 2px dashed #1E40AF; border-radius: 12px; padding: 24px; display: inline-block; margin-bottom: 24px;">
              <span style="font-size: 2.5rem; font-weight: 900; letter-spacing: 12px; color: #1E40AF; font-family: monospace;">${otp}</span>
            </div>
            <p style="font-size: 0.8rem; color: #adb5bd;">If you did not request this code, ignore this email. Do not share this code with anyone.</p>
          </div>
        </div>
      `
  });
  console.log(`📧 OTP email sent to ${to}`);
};

const sendVerificationEmail = async ({ to, verifyUrl }) => {
  const transport = getTransporter();
  if (!transport) throw new Error('Email transporter not available');
  await transport.sendMail({
    from: `"TicketDesk" <${process.env.FROM_EMAIL || process.env.SUPPORT_EMAIL}>`,
    to,
    subject: 'Verify your TicketDesk email',
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1E40AF; color: white; padding: 24px 30px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">Verify your email address</h2>
          </div>
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
            <p>Hi there,</p>
            <p>Someone requested to register this email address on <strong>TicketDesk</strong>. Click the button below to verify your email.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyUrl}" style="background: #1E40AF; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 1rem;">Verify My Email</a>
            </div>
            <p style="font-size: 0.85rem; color: #6c757d;">This link expires in <strong>24 hours</strong>. If you did not request this, ignore this email.</p>
            <p style="font-size: 0.75rem; color: #adb5bd; margin-top: 20px;">Or copy this link: <a href="${verifyUrl}">${verifyUrl}</a></p>
          </div>
        </div>
      `
  });
  console.log(`📧 Verification email sent to ${to}`);
};

const sendPasswordSetEmail = async ({ to, name, password }) => {
  try {
    const transport = getTransporter();
    if (!transport) return;
    await transport.sendMail({
      from: `"TicketDesk" <${process.env.FROM_EMAIL || process.env.SUPPORT_EMAIL}>`,
      to,
      subject: 'Your TicketDesk account is ready',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #059669; color: white; padding: 24px 30px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">✅ Your account is ready!</h2>
          </div>
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
            <p>Hi <strong>${name}</strong>,</p>
            <p>Your TicketDesk account has been activated by the admin. Here are your login details:</p>
            <div style="background: white; border: 1px solid #dee2e6; border-radius: 6px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0 0 8px;"><strong>Email:</strong> ${to}</p>
              <p style="margin: 0;"><strong>Password:</strong> <code style="background: #f1f3f5; padding: 2px 8px; border-radius: 4px;">${password}</code></p>
            </div>
            <p style="color: #dc3545; font-weight: 600;">⚠️ Please keep this password safe. If you forget it, raise a support ticket and the admin will reset it for you.</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="background: #1E40AF; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700;">Login Now</a>
            </div>
          </div>
        </div>
      `
    });
    console.log(`📧 Password set email sent to ${to}`);
  } catch (err) {
    console.error('❌ Password set email error:', err.message);
  }
};

const sendTicketConfirmation = async ({ to, name, ticket }) => {
  try {
    const transport = getTransporter();
    if (!transport) return;

    const mailOptions = {
      from: `"IT Support" <${process.env.SUPPORT_EMAIL}>`,
      to,
      subject: `[${ticket.ticketId}] Ticket Received: ${ticket.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a1a2e; color: white; padding: 20px 30px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">🎫 Ticket Received</h2>
          </div>
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
            <p>Hi <strong>${name}</strong>,</p>
            <p>Your ticket has been successfully created and is being reviewed by our support team.</p>
            <div style="background: white; border: 1px solid #dee2e6; border-radius: 6px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0 0 8px;"><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
              <p style="margin: 0 0 8px;"><strong>Title:</strong> ${ticket.title}</p>
              <p style="margin: 0 0 8px;"><strong>Priority:</strong> ${ticket.priority.toUpperCase()}</p>
              <p style="margin: 0 0 8px;"><strong>Category:</strong> ${ticket.category}</p>
              <p style="margin: 0;"><strong>SLA Deadline:</strong> ${ticket.sla?.deadline ? new Date(ticket.sla.deadline).toLocaleString() : 'N/A'}</p>
            </div>
            <p>You will receive updates as your ticket progresses. You can also track your ticket status by logging into the support portal.</p>
            <p style="color: #6c757d; font-size: 13px; margin-top: 30px;">This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      `
    };

    if (ticket.emailSource && ticket.emailSource.messageId) {
      mailOptions.inReplyTo = ticket.emailSource.messageId;
      mailOptions.references = [ticket.emailSource.messageId];
      // Keep the original subject if it was a reply? 
      // Actually keeping the ticket subject is better for tracking.
    }

    await transport.sendMail(mailOptions);
    console.log(`📧 Confirmation email sent to ${to}`);
  } catch (err) {
    console.error('❌ Email send error:', err.message);
  }
};

const sendStatusUpdate = async ({ to, name, ticket, newStatus }) => {
  try {
    const transport = getTransporter();
    if (!transport) return;

    const statusColors = {
      in_progress: '#0d6efd',
      resolved: '#198754',
      closed: '#6c757d',
      pending_info: '#fd7e14'
    };

    await transport.sendMail({
      from: `"IT Support" <${process.env.SUPPORT_EMAIL}>`,
      to,
      subject: `[${ticket.ticketId}] Status Update: ${newStatus.replace('_', ' ').toUpperCase()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${statusColors[newStatus] || '#1a1a2e'}; color: white; padding: 20px 30px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">📋 Ticket Status Update</h2>
          </div>
          <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
            <p>Hi <strong>${name}</strong>,</p>
            <p>Your ticket <strong>${ticket.ticketId}</strong> status has been updated to <strong>${newStatus.replace(/_/g, ' ').toUpperCase()}</strong>.</p>
            ${newStatus === 'resolved' ? `<p style="color: #198754;"><strong>✅ Your issue has been resolved!</strong></p>` : ''}
            <p style="color: #6c757d; font-size: 13px; margin-top: 30px;">Log in to the portal for full details and to provide feedback.</p>
          </div>
        </div>
      `
    });
    console.log(`📧 Status update email sent to ${to}`);
  } catch (err) {
    console.error('❌ Status email error:', err.message);
  }
};

const sendAckEmail = async ({ to, name, ticket }) => {
  try {
    const transport = getTransporter();
    if (!transport) return;

    await transport.sendMail({
      from: `"IT Support" <${process.env.FROM_EMAIL || process.env.SUPPORT_EMAIL}>`,
      to,
      subject: `[${ticket.ticketId}] We've received your request`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a1a2e; color: white; padding: 20px 30px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">✅ Request Acknowledged</h2>
          </div>
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
            <p>Hi <strong>${name}</strong>,</p>
            <p>We have received your support request and our team is now working on it.</p>
            <div style="background: white; border: 1px solid #dee2e6; border-radius: 6px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0 0 8px;"><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
              <p style="margin: 0 0 8px;"><strong>Title:</strong> ${ticket.title}</p>
              <p style="margin: 0;"><strong>Priority:</strong> ${ticket.priority.toUpperCase()}</p>
            </div>
            <p style="color: #6c757d; font-size: 13px; margin-top: 30px;">This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      `
    });
    console.log(`📧 Ack email sent to ${to}`);
  } catch (err) {
    console.error('❌ Ack email error:', err.message);
  }
};

const sendResolveEmail = async ({ to, name, ticket }) => {
  try {
    const transport = getTransporter();
    if (!transport) return;

    await transport.sendMail({
      from: `"IT Support" <${process.env.FROM_EMAIL || process.env.SUPPORT_EMAIL}>`,
      to,
      subject: `[${ticket.ticketId}] Your request has been resolved`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #198754; color: white; padding: 20px 30px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">✅ Issue Officially Resolved</h2>
          </div>
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
            <p>Hi <strong>${name}</strong>,</p>
            <p>Your support ticket has been officially closed following your confirmation.</p>
            <div style="background: white; border: 1px solid #dee2e6; border-radius: 6px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0 0 8px;"><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
              <p style="margin: 0 0 8px;"><strong>Title:</strong> ${ticket.title}</p>
              <p style="margin: 0;"><strong>Final Status:</strong> COMPLETED / CLOSED</p>
            </div>
            <p>Thank you for your feedback and for helping us maintain high support standards.</p>
            <p style="color: #6c757d; font-size: 13px; margin-top: 30px;">This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      `
    });
    console.log(`📧 Resolve email sent to ${to}`);
  } catch (err) {
    console.error('❌ Resolve email error:', err.message);
  }
};

const sendStatusChangeEmail = async ({ to, name, ticket, newStatus }) => {
  try {
    const transport = getTransporter();
    if (!transport) return;

    const statusMap = {
      assigned:        { label: '👤 Ticket Assigned',        color: '#6366F1', message: 'Your ticket has been assigned to a support agent who will begin working on it shortly.' },
      in_progress:     { label: '🔧 We are working on it',   color: '#2563EB', message: 'Good news! Our team has started working on your problem. We will keep you updated.' },
      almost_complete: { label: '🏁 Almost done!',           color: '#7C3AED', message: 'We are almost finished fixing your issue. It should be resolved very soon.' },
      resolved:        { label: '🔍 Fix Verification Requested', color: '#059669', message: 'The agent has finished their work and marked the issue as fixed. Please log in to verify the solution so we can officially close this ticket.' },
      pending_info:    { label: '❓ We need more info',      color: '#D97706', message: 'We need a bit more information from you to continue. Please check your ticket and reply.' },
      reopened:        { label: '🔄 Ticket Reopened',        color: '#EF4444', message: 'Your ticket has been reopened and is back in our queue.' },
      closed:          { label: '🔒 Ticket closed',          color: '#64748B', message: 'Your ticket has been closed. If the problem comes back, you can always open a new one.' },
    };

    const s = statusMap[newStatus] || { label: `Update on your ticket`, color: '#1a1a2e', message: `Your ticket status has been updated to ${newStatus.replace(/_/g, ' ')}.` };

    const mailOptions = {
      from: `"IT Support" <${process.env.FROM_EMAIL || process.env.SUPPORT_EMAIL}>`,
      to,
      subject: `[${ticket.ticketId}] ${s.label}: ${ticket.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${s.color}; color: white; padding: 20px 30px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">${s.label}</h2>
          </div>
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
            <p>Hi <strong>${name}</strong>,</p>
            <p>${s.message}</p>
            <div style="background: white; border: 1px solid #dee2e6; border-radius: 6px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0 0 8px;"><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
              <p style="margin: 0 0 8px;"><strong>Problem:</strong> ${ticket.title}</p>
              <p style="margin: 0;"><strong>Current Status:</strong> ${newStatus.replace(/_/g, ' ').toUpperCase()}</p>
            </div>
            <p>You can check your ticket anytime by logging into the support portal.</p>
            <p style="color: #6c757d; font-size: 13px; margin-top: 30px;">This is an automatic update. Please do not reply to this email.</p>
          </div>
        </div>
      `
    };

    // Threading support for email-originated tickets
    if (ticket.emailSource && ticket.emailSource.messageId) {
      mailOptions.inReplyTo = ticket.emailSource.messageId;
      mailOptions.references = [ticket.emailSource.messageId];
    }

    await transport.sendMail(mailOptions);
    console.log(`📧 Status change email (${newStatus}) sent to ${to}`);
  } catch (err) {
    console.error('❌ Status change email error:', err.message);
  }
};

module.exports = { sendOtpEmail, sendVerificationEmail, sendPasswordSetEmail, sendTicketConfirmation, sendStatusUpdate, sendAckEmail, sendResolveEmail, sendStatusChangeEmail };

