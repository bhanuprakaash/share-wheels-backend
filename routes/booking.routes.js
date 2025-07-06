const express = require('express');
const bookingController = require('../controllers/booking.controller');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);
router.post('/', bookingController.bookTrip);
router.patch('/driver-approval/:booking_id', bookingController.driverApproval);

module.exports = router;
