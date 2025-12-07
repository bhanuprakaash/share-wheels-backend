if (process.env.NODE_ENV === 'production') {
  require('dotenv').config({ path: '.env.prod' });
} else {
  require('dotenv').config({ path: '.env.dev' });
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT,
  DB_URL: process.env.DB_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS) || 10,
  HERE_MAPS_API_KEY: process.env.HERE_MAPS_API_KEY,
  HERE_MAPS_APP_ID: process.env.HERE_MAPS_APP_ID,
  FCM_TYPE: process.env.FCM_TYPE,
  FCM_PROJECT_ID: process.env.FCM_PROJECT_ID,
  FCM_PRIVATE_KEY_ID: process.env.FCM_PRIVATE_KEY_ID,
  FCM_PRIVATE_KEY: process.env.FCM_PRIVATE_KEY,
  FCM_CLIENT_EMAIL: process.env.FCM_CLIENT_EMAIL,
  FCM_CLIENT_ID: process.env.FCM_CLIENT_ID,
  FCM_AUTH_URI: process.env.FCM_AUTH_URI,
  FCM_TOKEN_URI: process.env.FCM_TOKEN_URI,
  FCM_AUTH_PROVIDER_CERT_URL: process.env.FCM_AUTH_PROVIDER_CERT_URL,
  FCM_CLIENT_CERT_URL: process.env.FCM_CLIENT_CERT_URL,
  FCM_UNIVERSE_DOMAIN: process.env.FCM_UNIVERSE_DOMAIN,
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
};
