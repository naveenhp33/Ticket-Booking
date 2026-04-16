const nodemailer = require('nodemailer');
const { google } = require('googleapis');

const OAuth2 = google.auth.OAuth2;

let transporter = null;

const getTransporter = async () => {
  if (transporter) return transporter;

  const oauth2Client = new OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );

  oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

  const { token: accessToken } = await oauth2Client.getAccessToken();

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.SUPPORT_EMAIL,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      accessToken
    }
  });

  return transporter;
};

const sendTicketConfirmation = async ({ to, name, ticket }) => {
  try {
    const transport = await getTransporter();
    await transport.sendMail({
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
    });
  } catch (err) {
    console.error('Email send error:', err.message);
  }
};

const sendStatusUpdate = async ({ to, name, ticket, newStatus }) => {
  try {
    const transport = await getTransporter();
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
  } catch (err) {
    console.error('Status email error:', err.message);
  }
};

module.exports = { sendTicketConfirmation, sendStatusUpdate };
