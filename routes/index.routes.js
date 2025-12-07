const express = require('express');
const userRoutes = require('./user.routes');
const vehicleRoutes = require('./vehicle.routes');
const tripRoutes = require('./trip.routes');
const bookingRoutes = require('./booking.routes');

const router = express.Router();

module.exports = (controllers, repositories) => {
  const {
    bookingController,
    tripController,
    userController,
    vehicleController,
  } = controllers;

  router.use('/user', userRoutes({ userController }));
  router.use('/vehicle', vehicleRoutes({ vehicleController }));
  router.use('/trip', tripRoutes({ tripController }));
  router.use('/booking', bookingRoutes({ bookingController, repositories }));

  router.get('/health', (req, res) => {
    res.json({
      success: true,
      message: 'Server is running',
      timestamp: new Date().toISOString(),
    });
  });

  return router;
};
