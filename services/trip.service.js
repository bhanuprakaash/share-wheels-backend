const Trip = require('../models/trip.model');

class TripService {
  static async createTrip(tripData, waypoints = []) {
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

      const result = await Trip.create(tripData, processWaypoints);

      return { trip: result.trip, waypoints: result.waypoints };
    } catch (err) {
      throw err;
    }
  }

  static async getTripById(tripId) {
    try {
      const tripWithWaypoints = await Trip.findById(tripId);
      if (!tripWithWaypoints) {
        throw new Error('Trip not found');
      }

      return tripWithWaypoints;
    } catch (err) {
      throw err;
    }
  }

  static async updateTrip(tripId, tripData, waypoints = []) {
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

      return await Trip.update(tripId, tripData, processedWaypoints);
    } catch (err) {
      throw err;
    }
  }

  static async updateTripStatus(tripId, status) {
    try {
      return await Trip.updateByStatus(tripId, status);
    } catch (err) {
      throw err;
    }
  }

  static async updateSeatsInTrip(dbInstance,tripId, bookedSeats){
    try{
      return await Trip.updateSeatsInTrip(dbInstance, tripId, bookedSeats);
    }catch(err){
      throw err;
    }
  }

  static async getAvailableSeats(transaction, tripId){
    try{
      return await Trip.getAvailableSeatsByTripId(transaction, tripId);
    }catch(err){
      throw err;
    }
  }

  static async deleteTrip(tripId) {
    try {
      return await Trip.delete(tripId);
    } catch (err) {
      throw err;
    }
  }

  static async getAllTrips(filters = {}) {
    try {
      return await Trip.findAll(filters);
    } catch (err) {
      throw err;
    }
  }

  static _validateAndConvertInputCoordinates(geopoint, fieldName) {
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

  static _processWaypoints(waypoints) {
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
