require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { connectRedis } = require('./config/redis');

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  await connectRedis();
  await connectRabbitMQ(); // producer channel — the API only publishes jobs, never consumes

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
};

start();
