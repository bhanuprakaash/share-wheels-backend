const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const config = require('./env');

const connection = new IORedis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    maxRetriesPerRequest: null,
});

connection.on('connect', () => {
    console.log('Redis connected successfully');
});

const notificationQueue = new Queue('notification-queue', { connection });

module.exports = { notificationQueue, connection };