const Redis = require('ioredis');
const config = require('./env');

const redisOptions = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  db: config.REDIS_DB,
  keyPrefix: config.REDIS_PREFIX,
  connectionTimeoutMillis: 10000,
  maxRetriesPerRequest: 5,
  retryStrategy: (times) => {
    const delay = Math.min(times * 100, 5000);
    console.warn(`Redis: Retrying connection ${times}`);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetErrors = [/READONLY/, /ETIMEDOUT/];
    return targetErrors.some((targetError) => targetError.test(err.member));
  },
};

let redisClient;

function getRedisClient() {
  if(!redisClient) {
    redisClient = new Redis(redisOptions);

    redisClient.on('connect',()=>console.log('Redis Connected'));
    redisClient.on('ready',()=>console.log('Redis Ready'));
    redisClient.on('error',(err)=>console.log('Redis Error', err.message));
    redisClient.on('close',()=>console.log('Redis Closed'));
    redisClient.on('reconnecting',()=>console.log('Redis Reconnecting'));
    redisClient.on('error',(err)=>console.log('Redis Error', err.message));
  }
  return redisClient;
}

async function disconnectRedis(){
  if(redisClient && redisClient.status === 'ready') {
    await redisClient.close();
    redisClient = null;
    console.log('Redis Disconnected');
  }
}

module.exports = {
  redisClient: getRedisClient(),
    disconnectRedis: disconnectRedis,
}