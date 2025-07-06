const User = require('../models/user.model');
const Trip = require('../models/trip.model');
const Booking = require('../models/booking.model');

class BookingService {
  static async bookTrip(bookingData) {
    try {
      return await Booking.addBooking(bookingData);
    } catch (err) {
      throw err;
    }
  }

  static async driverApprovalOnBooking(bookingData) {
    try {
      return await Booking.updateBookingStatusByDriver(bookingData);
    } catch (err) {
      throw err;
    }
  }
}

module.exports = BookingService;
