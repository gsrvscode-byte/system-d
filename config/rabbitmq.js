// config/rabbitmq.js
// -----------------------------------------------------------------------------
// Handles RabbitMQ connection + channel setup.
//
// Used to decouple slow/non-critical side effects (sending emails) from the
// main request/response cycle: the API only has to publish a small message
// and return, instead of waiting on an SMTP round trip. A separate worker
// process (workers/email.worker.js) consumes the queue and does the actual
// sending.
// -----------------------------------------------------------------------------

const amqplib = require('amqplib');

const EMAIL_QUEUE = 'email_notifications';

let connection = null;
let channel = null;

/**
 * Connects to RabbitMQ and asserts the queues this app depends on.
 * Retries on startup since Docker Compose may bring the app container up
 * before the RabbitMQ broker has finished initializing.
 * @returns {Promise<import('amqplib').Channel>}
 */
const connectRabbitMQ = async (retries = 10, delayMs = 3000) => {
  const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      connection = await amqplib.connect(url);
      channel = await connection.createChannel();

      // durable: true -> queue survives a broker restart.
      await channel.assertQueue(EMAIL_QUEUE, { durable: true });

      connection.on('error', (err) => {
        console.error('RabbitMQ connection error:', err.message);
      });

      connection.on('close', () => {
        console.warn('RabbitMQ connection closed');
      });

      console.log('RabbitMQ connected successfully');
      return channel;
    } catch (error) {
      console.error(
        `RabbitMQ connection attempt ${attempt}/${retries} failed: ${error.message}`
      );

      if (attempt === retries) {
        console.error('Could not connect to RabbitMQ. Exiting.');
        process.exit(1);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};

/**
 * Returns the active channel. Throws if connectRabbitMQ() hasn't run yet —
 * callers should only reach this after server startup has completed.
 */
const getChannel = () => {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized. Call connectRabbitMQ() first.');
  }
  return channel;
};

const closeRabbitMQ = async () => {
  if (channel) await channel.close();
  if (connection) await connection.close();
};

module.exports = { connectRabbitMQ, getChannel, closeRabbitMQ, EMAIL_QUEUE };
