const express = require('express');
const bookingController = require('../controllers/booking.controller');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);
router.post('/', bookingController.bookTrip);
router.patch('/driver/status/:booking_id', bookingController.updateBookingStatusByDriver);
router.patch('/rider/status/:booking_id', bookingController.updateBookingStatusByRider);

module.exports = router;
