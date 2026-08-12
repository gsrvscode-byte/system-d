// cache/index.js
// -----------------------------------------------------------------------------
// Shared cache-aside helper. Every service that caches something goes
// through this instead of calling redisClient directly, so:
//   - JSON encode/decode isn't repeated in every service
//   - a Redis outage degrades to "just hit MongoDB" instead of crashing
//     requests — caching should never be a new point of failure
// -----------------------------------------------------------------------------

const { redisClient } = require('../config/redis');

/**
 * Reads a JSON value from cache. Returns null on a miss OR on any Redis
 * error (treated the same way by callers — both mean "go to the DB").
 * @param {string} key
 */
const get = async (key) => {
  try {
    if (!redisClient.isOpen) return null;
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error(`Cache read failed for key "${key}":`, error.message);
    return null;
  }
};

/**
 * Writes a JSON value to cache with a TTL. Failures are swallowed —
 * a failed cache write should never fail the request that triggered it.
 * @param {string} key
 * @param {*} value
 * @param {number} ttlSeconds
 */
const set = async (key, value, ttlSeconds) => {
  try {
    if (!redisClient.isOpen) return;
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.error(`Cache write failed for key "${key}":`, error.message);
  }
};

/**
 * Deletes one or more keys. Used on writes to invalidate stale entries.
 * @param {string|string[]} keys
 */
const del = async (keys) => {
  try {
    if (!redisClient.isOpen) return;
    const list = Array.isArray(keys) ? keys : [keys];
    if (list.length > 0) await redisClient.del(list);
  } catch (error) {
    console.error('Cache delete failed:', error.message);
  }
};

/**
 * Deletes every key matching a pattern (e.g. "dashboard:*"). Uses SCAN
 * rather than KEYS so it doesn't block Redis on a large keyspace.
 * @param {string} pattern
 */
const delByPattern = async (pattern) => {
  try {
    if (!redisClient.isOpen) return;
    const keys = [];
    for await (const key of redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
    }
    if (keys.length > 0) await redisClient.del(keys);
  } catch (error) {
    console.error(`Cache pattern-delete failed for "${pattern}":`, error.message);
  }
};

module.exports = { get, set, del, delByPattern };
