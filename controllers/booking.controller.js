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

  async updateBookingStatusByDriver(req, res, next){
    try{
      const {booking_id} = req.params;
      const driverResponse = await BookingService.updateBookingStatusByDriver({
        ...req.body,
        booking_id: booking_id
      });
      res.status(200).json({
        success: true,
        message: `Your Booking is ${driverResponse?.bookings_status} by Driver`,
        data: driverResponse,
      });
    } catch(err){
      next(err);
    }
  },

  async updateBookingStatusByRider(req, res, next){
    try{
      const {booking_id} = req.params;
      const riderResponse = await BookingService.updateBookingStatusByRider({...req.body,booking_id:booking_id});
      res.status(200).json({
        success: true,
        message: 'Booking is updated Successfully',
        data: riderResponse
      })
    }catch(err){
      next(err);
    }
  }
};

module.exports = BookingController;
