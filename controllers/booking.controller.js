const BookingService = require('../services/booking.service');

const BookingController = {
  async bookTrip(req, res, next) {
    try {
      const result = await BookingService.bookTrip(req.body);
      res.status(201).json({
        success: true,
        message: 'Booking Created Successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  async driverApproval(req, res, next) {
    const { booking_id } = req.params;
    try {
      const driverResponse = await BookingService.driverApprovalOnBooking({
        ...req.body,
        booking_id: booking_id,
      });
      res.status(200).json({
        success: true,
        message: `Your Booking is ${driverResponse?.bookings_status} by Driver`,
        data: driverResponse,
      });
    } catch (err) {
      next(err);
    }
  },

  async riderCancellation(req, res, next) {
    try {
      const { booking_id } = req.params;
      const riderResponse = await BookingService.bookingCancellationByRider({
        ...req.body,
        booking_id: booking_id,
      });
      res.status(200).json({
        success: true,
        message: `Your Booking Cancelled Successfully!`,
        data: riderResponse,
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = BookingController;
