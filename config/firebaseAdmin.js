const admin = require('firebase-admin');
const config = require('./env');

let serviceAccount;

if (
  config.FCM_TYPE &&
  config.FCM_PROJECT_ID &&
  config.FCM_PRIVATE_KEY_ID &&
  config.FCM_PRIVATE_KEY &&
  config.FCM_CLIENT_EMAIL &&
  config.FCM_CLIENT_ID &&
  config.FCM_AUTH_URI &&
  config.FCM_TOKEN_URI &&
  config.FCM_AUTH_PROVIDER_CERT_URL &&
  config.FCM_CLIENT_CERT_URL
) {
  try {
    const privateKey = config.FCM_PRIVATE_KEY.replace(/\\n/g, '\n');
    serviceAccount = {
      type: config.FCM_TYPE,
      project_id: config.FCM_PROJECT_ID,
      private_key_id: config.FCM_PRIVATE_KEY_ID,
      private_key: privateKey,
      client_email: config.FCM_CLIENT_EMAIL,
      client_id: config.FCM_CLIENT_ID,
      auth_uri: config.FCM_AUTH_URI,
      token_uri: config.FCM_TOKEN_URI,
      auth_provider_x509_cert_url: config.FCM_AUTH_PROVIDER_CERT_URL,
      client_x509_cert_url: config.FCM_CLIENT_CERT_URL,
      universe_domain: config.FCM_UNIVERSE_DOMAIN,
    };
  } catch (err) {
    console.error(err);
    serviceAccount = null;
  }
} else {
  console.warn('Firebase Admin SDK is not initialized');
}

if (serviceAccount && !admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('Firebase Admin SDK is initialized Successfully');
} else if (!serviceAccount) {
  console.warn('Firebase Admin SDK is not initialized');
}

module.exports = admin;
