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
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS) || 12,
  HERE_MAPS_API_KEY: process.env.HERE_MAPS_API_KEY,
  HERE_MAPS_APP_ID: process.env.HERE_MAPS_APP_ID,
};
