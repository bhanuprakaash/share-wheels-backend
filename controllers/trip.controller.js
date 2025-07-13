class TripController {

  constructor(tripService){
    this.tripService = tripService;
  }

  createTrip = async(req, res, next) => {
    try {
      const { waypoints, ...tripData } = req.body;

      const result = await this.tripService.createTrip(tripData, waypoints);

      res.status(201).json({
        success: true,
        message: 'Trip Created Successfully',
        data: { trip: result.trip, waypoints: result.waypoints },
      });
    } catch (err) {
      next(err);
    }
  }

  getTripById = async(req, res, next) =>{
    try {
      const { tripId } = req.params;
      const result = await this.tripService.getTripById(tripId);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  updateTrip= async(req, res, next)=> {
    try {
      const { tripId } = req.params;
      const { waypoints, ...tripData } = req.body;

      const result = await this.tripService.updateTrip(tripId, tripData, waypoints);

      res.status(200).json({
        success: true,
        message: 'Trip updated successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  updateTripStatus= async(req, res, next)=> {
    try {
      const { tripId } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required',
        });
      }

      const result = await this.tripService.updateTripStatus(tripId, status);

      res.status(200).json({
        success: true,
        message: 'Trip status updated successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  deleteTrip= async(req, res, next)=> {
    try {
      const { tripId } = req.params;

      const result = await this.tripService.deleteTrip(tripId);

      res.status(200).json({
        success: true,
        message: 'Trip deleted successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  getAllTrips= async(req, res, next) =>{
    try {
      const {
        driver_id,
        trip_status,
        departure_date,
        limit = 20,
        offset = 0,
        start_lat,
        start_lng,
        end_lat,
        end_lng,
        radius_km = 50,
      } = req.query;

      const filters = {
        driver_id,
        trip_status,
        departure_date,
        limit: parseInt(limit),
        offset: parseInt(offset),
        radius_km: parseInt(radius_km),
      };

      // Convert lat/lng to POINT format for filtering
      if (start_lat && start_lng) {
        filters.start_location = {
          lat: parseFloat(start_lat),
          lng: parseFloat(start_lng),
        };
      }

      if (end_lat && end_lng) {
        filters.end_location = {
          lat: parseFloat(end_lat),
          lng: parseFloat(end_lng),
        };
      }

      const trips = await this.tripService.getAllTrips(filters);

      res.status(200).json({
        success: true,
        data: trips,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: trips.length,
        },
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = TripController;
