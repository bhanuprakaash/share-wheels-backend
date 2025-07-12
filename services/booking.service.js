const Booking = require('../models/booking.model');
const NotificationService = require('../services/notification.service');

class BookingService {
  static async bookTrip(bookingData) {
    try {
      const bookingResponse = await Booking.addBooking(bookingData);
      if (bookingResponse) {
        const { driver_id, booking_id, trip_id, rider_id, bookings_status } =
          bookingResponse;
        await NotificationService.sendNewBookingRequest(driver_id, {
          booking_id: booking_id,
          trip_id: trip_id,
          rider_id: rider_id,
          bookings_status: bookings_status,
        });
      }
      return bookingResponse;
    } catch (err) {
      throw err;
    }
  }

  static async driverApprovalOnBooking(bookingData) {
    try {
      const approvalResponse =
        await Booking.updateBookingStatusByDriver(bookingData);
      if (approvalResponse) {
        const { booking_id, trip_id, bookings_status, driver_id, rider_id } =
          approvalResponse;
        await NotificationService.sendBookingStatusUpdate(rider_id, {
          booking_id: booking_id,
          trip_id: trip_id,
          bookings_status: bookings_status,
          driver_id: driver_id,
        });
      }
      return approvalResponse;
    } catch (err) {
      throw err;
    }
  }

  static async bookingCancellationByRider(bookingData) {
    try {
      const result = await Booking.updateBookingStatusByRider(bookingData);
      if (result && result.sendNotificationToDriver) {
        const { driver_id, updated_seats, booking_id } = result;
        await NotificationService.sendRiderCancellationRequest(driver_id, {
          available_seats: updated_seats,
          booking_id: booking_id,
        });
      }
    } catch (err) {
      throw err;
    }
  }
}

module.exports = BookingService;
