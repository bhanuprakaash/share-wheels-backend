class BookingController {
  constructor(bookingService) {
    this.bookingService = bookingService;
  }

  bookTrip = async (req, res, next) => {
    try {
      const result = await this.bookingService.bookTrip(req.body);
      res.status(201).json({
        success: true,
        message: 'Booking Created Successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  getBookingsByUserId = async (req, res, next) => {
    try {
      const { riderId } = req.params;
      const result = await this.bookingService.getBookingsByUserId(riderId);
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Bookings Fetched Successfully',
      });
    } catch (err) {
      next(err);
    }
  };

  getBookingsByTripId = async (req, res, next) => {
    try {
      const { tripId } = req.params;
      const result = await this.bookingService.getBookingsByTripId(tripId);
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Bookings Fetched Successfully',
      });
    } catch (err) {
      next(err);
    }
  };

  updateBookingStatusByDriver = async (req, res, next) => {
    try {
      const { booking_id } = req.params;
      const driverResponse =
        await this.bookingService.updateBookingStatusByDriver({
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
  };

  updateBookingStatusByRider = async (req, res, next) => {
    try {
      const { booking_id } = req.params;
      const riderResponse =
        await this.bookingService.updateBookingStatusByRider({
          ...req.body,
          booking_id: booking_id,
        });
      res.status(200).json({
        success: true,
        message: 'Booking is updated Successfully',
        data: riderResponse,
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = BookingController;
