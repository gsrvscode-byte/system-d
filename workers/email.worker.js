#!/usr/bin/env node
// workers/email.worker.js
// -----------------------------------------------------------------------------
// Standalone worker process. Runs as its own Docker container
// (see docker-compose.yml -> email-worker service) so that SMTP latency,
// retries, or an SMTP outage never affect the main API's response times or
// its ability to scale independently.
//
// Usage:
//   node workers/email.worker.js
// -----------------------------------------------------------------------------

require('dotenv').config();
const { connectRabbitMQ, EMAIL_QUEUE } = require('../config/rabbitmq');
const { verifyEmailConnection } = require('../config/email');
const { sendTemplatedEmail } = require('../services/email.service');

const MAX_ATTEMPTS = 3;

const run = async () => {
  await verifyEmailConnection();
  const channel = await connectRabbitMQ();

  // Only hand this worker one unacknowledged message at a time. Without
  // this, RabbitMQ pushes the whole backlog at once, which is pointless
  // for a worker that processes jobs one email at a time anyway.
  channel.prefetch(1);

  console.log(`Email worker listening on queue "${EMAIL_QUEUE}"...`);

  channel.consume(EMAIL_QUEUE, async (msg) => {
    if (!msg) return;

    let job;
    try {
      job = JSON.parse(msg.content.toString());
    } catch (error) {
      console.error('Discarding malformed email job:', error.message);
      channel.ack(msg); // can't retry something that isn't valid JSON
      return;
    }

    try {
      await sendTemplatedEmail(job);
      console.log(`Email sent: template="${job.template}" to="${job.to}"`);
      channel.ack(msg);
    } catch (error) {
      const attempts = (msg.properties.headers?.['x-attempts'] || 0) + 1;
      console.error(
        `Failed to send email (attempt ${attempts}/${MAX_ATTEMPTS}):`,
        error.message
      );

      if (attempts >= MAX_ATTEMPTS) {
        // Give up on this message rather than retry forever; in a fuller
        // system this would go to a dead-letter queue for manual review.
        console.error(`Giving up on job after ${MAX_ATTEMPTS} attempts:`, job);
        channel.ack(msg);
      } else {
        // Requeue with an incremented attempt counter.
        channel.nack(msg, false, false);
        channel.sendToQueue(EMAIL_QUEUE, msg.content, {
          persistent: true,
          headers: { 'x-attempts': attempts },
        });
      }
    }
  });
};

run().catch((error) => {
  console.error('Email worker failed to start:', error);
  process.exit(1);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Email worker shutting down...');
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
