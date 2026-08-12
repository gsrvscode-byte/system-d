// queues/email.queue.js
// -----------------------------------------------------------------------------
// Publisher-side helper for the email queue. Services call publishEmailJob()
// instead of sending mail directly — this is what makes user/task creation
// requests return instantly instead of waiting on an SMTP round trip.
// -----------------------------------------------------------------------------

const { getChannel, EMAIL_QUEUE } = require('../config/rabbitmq');

/**
 * Publishes an email job onto the queue for the worker to pick up.
 * @param {Object} job
 * @param {string} job.template - which email template to render, e.g. 'welcome', 'task-assigned'
 * @param {string} job.to - recipient email address
 * @param {Object} job.data - template variables
 */
const publishEmailJob = async (job) => {
  try {
    const channel = getChannel();
    const payload = Buffer.from(JSON.stringify(job));

    // persistent: true -> message survives a broker restart (paired with a
    // durable queue in config/rabbitmq.js).
    channel.sendToQueue(EMAIL_QUEUE, payload, { persistent: true });
  } catch (error) {
    // Publishing an email job should never fail the request that triggered
    // it (e.g. task creation) — log and move on.
    console.error('Failed to publish email job:', error.message);
  }
};

module.exports = { publishEmailJob };
