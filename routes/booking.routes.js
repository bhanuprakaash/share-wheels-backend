const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

module.exports = ({ bookingController }) => {
  router.use(authenticateToken);
  router.post('/', bookingController.bookTrip);
  router.patch(
    '/driver/status/:booking_id',
    bookingController.updateBookingStatusByDriver
  );
  router.patch(
    '/rider/status/:booking_id',
    bookingController.updateBookingStatusByRider
  );

  return router;
};
