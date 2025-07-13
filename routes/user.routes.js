const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

module.exports = ({userController})=>{
  //public routes
  router.post('/signup', userController.createUser);
  router.post('/login', userController.loginUser);

  //private routes
  router.use(authenticateToken);
  router.get('/:id', userController.getUser);
  router.patch('/:id', userController.updateUser);
  router.patch('/reset-password/:id', userController.updateUserPassword);
  router.delete('/:id', userController.deleteUser);
  router.put('/preferences/:id', userController.updateUserPreferences);
  router.get('/preferences/:id', userController.getUserPreferences);
  // router.post('/register-fcm-token/:user_id', userController.registerFcmToken);
  // router.post(
  //   '/unregister-fcm-token/:user_id',
  //   userController.unRegisterFcmToken
  // );

  return router;
};
