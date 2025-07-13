class TripService {

  constructor(tripRepository){
    this.tripRepository = tripRepository;
  }

  async createTrip(tripData, waypoints = []) {
    try {
      if (tripData.start_geopoint) {
        tripData.start_geopoint = this._validateAndConvertInputCoordinates(
          tripData.start_geopoint,
          'start_geopoint'
        );
      }

      if (tripData.end_geopoint) {
        tripData.end_geopoint = this._validateAndConvertInputCoordinates(
          tripData.end_geopoint,
          'end_geopoint'
        );
      }

      const processWaypoints = this._processWaypoints(waypoints);

      const result = await this.tripRepository.create(tripData, processWaypoints);

      return { trip: result.trip, waypoints: result.waypoints };
    } catch (err) {
      throw err;
    }
  }

  async getTripById(tripId) {
    try {
      const tripWithWaypoints = await this.tripRepository.findById(tripId);
      if (!tripWithWaypoints) {
        throw new Error('Trip not found');
      }

      return tripWithWaypoints;
    } catch (err) {
      throw err;
    }
  }

  async updateTrip(tripId, tripData, waypoints = []) {
    try {
      if (tripData.start_geopoint) {
        tripData.start_geopoint = this._validateAndConvertInputCoordinates(
          tripData.start_geopoint,
          'start_geopoint'
        );
      }

      if (tripData.end_geopoint) {
        tripData.end_geopoint = this._validateAndConvertInputCoordinates(
          tripData.end_geopoint,
          'end_geopoint'
        );
      }

      const processedWaypoints = this._processWaypoints(waypoints);

      return await this.tripRepository.update(tripId, tripData, processedWaypoints);
    } catch (err) {
      throw err;
    }
  }

  async updateTripStatus(tripId, status,transaction=undefined) {
    try {
      return await this.tripRepository.updateByStatus(tripId, status,transaction);
    } catch (err) {
      throw err;
    }
  }

  async updateSeatsInTrip(dbInstance,tripId, bookedSeats){
    try{
      return await this.tripRepository.updateSeatsInTrip(dbInstance, tripId, bookedSeats);
    }catch(err){
      throw err;
    }
  }

  async getAvailableSeats(transaction, tripId){
    try{
      return await this.tripRepository.getAvailableSeatsByTripId(transaction, tripId);
    }catch(err){
      throw err;
    }
  }

  async deleteTrip(tripId) {
    try {
      return await this.tripRepository.delete(tripId);
    } catch (err) {
      throw err;
    }
  }

  async getAllTrips(filters = {}) {
    try {
      return await this.tripRepository.findAll(filters);
    } catch (err) {
      throw err;
    }
  }

  _validateAndConvertInputCoordinates(geopoint, fieldName) {
    if (typeof geopoint === 'object' && geopoint != null) {
      if (
        typeof geopoint.lat === 'number' &&
        typeof geopoint.lng === 'number'
      ) {
        return `POINT(${geopoint.lng} ${geopoint.lat})`;
      } else {
        throw new Error(`Invalid ${fieldName} format, Expected {lat,lng}`);
      }
    }
  }

  _processWaypoints(waypoints) {
    if (!waypoints || waypoints.length === 0) {
      return [];
    }

    const sequenceOrders = waypoints.map((w) => w.sequence_order);
    const uniqueOrders = [...new Set(sequenceOrders)];
    if (sequenceOrders.length !== uniqueOrders.length) {
      throw new Error('Duplicate sequence orders in waypoints');
    }

    waypoints.sort((a, b) => a.sequence_order - b.sequence_order);

    return waypoints.map((waypoint) => {
      const processedWaypoint = { ...waypoint };

      if (processedWaypoint.geopoint) {
        processedWaypoint.geopoint = this._validateAndConvertInputCoordinates(
          processedWaypoint.geopoint,
          `waypoint (sequence_order: ${processedWaypoint.sequence_order})`
        );
      }
      return processedWaypoint;
    });
  }
}

module.exports = TripService;
