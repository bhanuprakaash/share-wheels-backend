const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const {
  authorizeDriver,
  authorizeRider,
} = require('../middleware/bookingAuth');

const router = express.Router();

module.exports = ({ bookingController, repositories }) => {
  const { bookingRepository, tripRepository } = repositories;

  router.use(authenticateToken);
  router.post('/', bookingController.bookTrip);
  router.get('/:riderId', bookingController.getBookingsByUserId);
  router.get('/trip/:tripId', bookingController.getBookingsByTripId);
  router.patch(
    '/driver/status/:booking_id',
    authorizeDriver(bookingRepository, tripRepository),
    bookingController.updateBookingStatusByDriver
  );
  router.patch(
    '/rider/status/:booking_id',
    authorizeRider(bookingRepository),
    bookingController.updateBookingStatusByRider
  );

  return router;
};
