const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

module.exports = ({ userController }) => {
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  });

  //public routes
  router.post('/signup', authLimiter, userController.createUser);
  router.post('/login', authLimiter, userController.loginUser);

  //private routes
  router.use(authenticateToken);
  router.get('/:id', userController.getUser);
  router.get('/verify/me', userController.getCurrentUser);
  router.patch('/:id', userController.updateUser);
  router.patch('/reset-password/:id', userController.updateUserPassword);
  router.delete('/:id', userController.deleteUser);
  router.put('/preferences/:id', userController.updateUserPreferences);
  router.get('/preferences/:id', userController.getUserPreferences);
  router.post('/register-fcm-token/:user_id', userController.registerFcmToken);
  router.post(
    '/unregister-fcm-token/:user_id',
    userController.unRegisterFcmToken
  );

  return router;
};
