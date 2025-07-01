const express = require('express');
const userRoutes = require('./user.routes');
const vehicleRoutes = require('./vehicle.routes');
const tripRouts = require('./trip.routes');

const router = express.Router();

router.use('/user', userRoutes);
router.use('/vehicle', vehicleRoutes);
router.use('/trip', tripRouts);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
