const express = require('express');
const userController = require("../controllers/UserController");
const {authenticateToken} = require("../middleware/auth");


const router = express.Router();

//public routes
router.post('/signup', userController.createUser);
router.post('/login', userController.loginUser);

//private routes
router.use(authenticateToken);
router.get('/:id', userController.getUser);
router.put('/:id', userController.updateUser);
router.put('/reset-password/:id', userController.updateUserPassword);
router.delete('/:id', userController.deleteUser);
router.put('/preferences/:id',userController.updateUserPreferences);
router.get('/preferences/:id', userController.getUserPreferences);

module.exports = router;