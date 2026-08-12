// config/email.js
// -----------------------------------------------------------------------------
// Nodemailer SMTP transporter setup, shared by the email worker.
//
// Env-driven so the same code works against MailHog locally (catches mail,
// no real sending, viewable at http://localhost:8025) and a real SMTP
// provider (SES, SendGrid, Gmail, etc.) in production — only .env changes.
// -----------------------------------------------------------------------------

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025', 10),
  secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for others
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      }
    : undefined, // MailHog needs no auth
});

const verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log('SMTP connection verified successfully');
  } catch (error) {
    // Non-fatal: the queue will simply retry/hold messages until SMTP is
    // reachable, so we don't want to crash the worker over a transient issue.
    console.error('SMTP connection verification failed:', error.message);
  }
};

module.exports = { transporter, verifyEmailConnection };
