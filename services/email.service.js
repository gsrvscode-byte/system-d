// services/email.service.js
// -----------------------------------------------------------------------------
// Renders and sends emails. Only ever called from the worker process
// (workers/email.worker.js) — never from the main API — so a slow/failed
// SMTP send can't stall an HTTP request.
// -----------------------------------------------------------------------------

const { transporter } = require('../config/email');

const FROM_ADDRESS = process.env.SMTP_FROM || 'Task Management <no-reply@taskapp.local>';

/**
 * Template registry. Each template is a pure function that takes the job's
 * `data` payload and returns { subject, html }. Adding a new email type
 * later (password reset, weekly digest, etc.) means adding one entry here.
 */
const templates = {
  welcome: (data) => ({
    subject: 'Welcome to the Task Management System',
    html: `
      <h2>Welcome, ${data.name}!</h2>
      <p>Your account has been created with the role <strong>${data.role}</strong>.</p>
      <p>You can now log in and start managing tasks.</p>
    `,
  }),

  'task-assigned': (data) => ({
    subject: `New Task Assigned: ${data.taskTitle}`,
    html: `
      <h2>Hi ${data.name},</h2>
      <p>You have been assigned to the task <strong>"${data.taskTitle}"</strong>.</p>
      ${data.priority ? `<p>Priority: <strong>${data.priority}</strong></p>` : ''}
      ${data.dueDate ? `<p>Due date: <strong>${new Date(data.dueDate).toLocaleDateString()}</strong></p>` : ''}
      <p>Log in to the dashboard for full details.</p>
    `,
  }),

  'task-status-changed': (data) => ({
    subject: `Task Update: ${data.taskTitle}`,
    html: `
      <h2>Hi ${data.name},</h2>
      <p>The task <strong>"${data.taskTitle}"</strong> status changed from
      <strong>${data.oldStatus}</strong> to <strong>${data.newStatus}</strong>.</p>
    `,
  }),
};

/**
 * Renders and sends a single email job.
 * @param {Object} job
 * @param {string} job.template - key into the `templates` registry above
 * @param {string} job.to
 * @param {Object} job.data
 */
const sendTemplatedEmail = async (job) => {
  const render = templates[job.template];
  if (!render) {
    throw new Error(`Unknown email template: "${job.template}"`);
  }

  const { subject, html } = render(job.data || {});

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: job.to,
    subject,
    html,
  });
};

module.exports = { sendTemplatedEmail, templates };
