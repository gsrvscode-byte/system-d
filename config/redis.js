// config/redis.js
// -----------------------------------------------------------------------------
// Handles Redis connection setup. Used as a cache-aside layer in front of
// MongoDB for expensive/frequent reads — see services/dashboard.service.js,
// services/task.service.js, and services/user.service.js for where it's
// actually used, and cache/index.js for the shared helper.
// -----------------------------------------------------------------------------

const { createClient } = require('redis');

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err.message);
});

redisClient.on('ready', () => {
  console.log('Redis connected successfully');
});

/**
 * Connects to Redis. Retries a few times on startup since Docker Compose
 * may bring the app container up before Redis has finished initializing.
 * @returns {Promise<void>}
 */
const connectRedis = async (retries = 10, delayMs = 3000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
      return;
    } catch (error) {
      console.error(
        `Redis connection attempt ${attempt}/${retries} failed: ${error.message}`
      );

      if (attempt === retries) {
        console.error('Could not connect to Redis. Exiting.');
        process.exit(1);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};

module.exports = { redisClient, connectRedis };
