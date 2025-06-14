const Trip = require("../models/trip.model");

class TripService {
    static async createTrip(tripData, waypoints = []) {
        try {
            if (tripData.start_geopoint && typeof tripData.start_geopoint === 'object') {
                if (tripData.start_geopoint.lat && tripData.start_geopoint.lng) {
                    tripData.start_geopoint = `POINT(${tripData.start_geopoint.lng} ${tripData.start_geopoint.lat})`;
                } else {
                    throw new Error('Invalid start_geopoint format. Expected {lat, lng} or POINT string');
                }
            }

            if (tripData.end_geopoint && typeof tripData.end_geopoint === 'object') {
                if (tripData.end_geopoint.lat && tripData.end_geopoint.lng) {
                    tripData.end_geopoint = `POINT(${tripData.end_geopoint.lng} ${tripData.end_geopoint.lat})`;
                } else {
                    throw new Error('Invalid end_geopoint format. Expected {lat, lng} or POINT string');
                }
            }

            if (waypoints && waypoints.length > 0) {
                const sequenceOrders = waypoints.map(w => w.sequence_order);
                const uniqueOrders = [...new Set(sequenceOrders)];
                if (sequenceOrders.length !== uniqueOrders.length) {
                    throw new Error('Duplicate sequence orders in waypoints');
                }

                waypoints.sort((a, b) => a.sequence_order - b.sequence_order);

                waypoints = waypoints.map(waypoint => {
                    if (typeof waypoint.geopoint === 'object') {
                        if (waypoint.geopoint.lat && waypoint.geopoint.lng) {
                            waypoint.geopoint = `POINT(${waypoint.geopoint.lng} ${waypoint.geopoint.lat})`;
                        } else {
                            throw new Error('Invalid waypoint geopoint format. Expected {lat, lng} or POINT string');
                        }
                    }
                    return waypoint;
                });
            }

            const result = await Trip.create(tripData, waypoints);

            return {trip: result.trip, waypoints: result.waypoints}

        } catch (err) {
            throw err;
        }
    }

    static async getTripById(tripId) {
        try {
            const tripWithWaypoints = await Trip.findById(tripId);
            if (!tripWithWaypoints) {
                throw new Error('Trip not found')
            }

            return tripWithWaypoints;
        } catch (err) {
            throw err;
        }
    }

    static async updateTrip(tripId, tripData, waypoints = []) {
        try {
            if (tripData.start_geopoint && typeof tripData.start_geopoint === 'object') {
                if (tripData.start_geopoint.lat && tripData.start_geopoint.lng) {
                    tripData.start_geopoint = `POINT(${tripData.start_geopoint.lng} ${tripData.start_geopoint.lat})`;
                } else {
                    throw new Error('Invalid start_geopoint format. Expected {lat, lng} or POINT string');
                }
            }

            if (tripData.end_geopoint && typeof tripData.end_geopoint === 'object') {
                if (tripData.end_geopoint.lat && tripData.end_geopoint.lng) {
                    tripData.end_geopoint = `POINT(${tripData.end_geopoint.lng} ${tripData.end_geopoint.lat})`;
                } else {
                    throw new Error('Invalid end_geopoint format. Expected {lat, lng} or POINT string');
                }
            }

            if (waypoints && waypoints.length > 0) {
                const sequenceOrders = waypoints.map(w => w.sequence_order);
                const uniqueOrders = [...new Set(sequenceOrders)];
                if (sequenceOrders.length !== uniqueOrders.length) {
                    throw new Error('Duplicate sequence orders in waypoints');
                }

                waypoints.sort((a, b) => a.sequence_order - b.sequence_order);

                waypoints = waypoints.map(waypoint => {
                    if (typeof waypoint.geopoint === 'object') {
                        if (waypoint.geopoint.lat && waypoint.geopoint.lng) {
                            waypoint.geopoint = `POINT(${waypoint.geopoint.lng} ${waypoint.geopoint.lat})`;
                        } else {
                            throw new Error('Invalid waypoint geopoint format. Expected {lat, lng} or POINT string');
                        }
                    }
                    return waypoint;
                });
            }

            return await Trip.update(tripId, tripData, waypoints);
        } catch (err) {
            throw err;
        }
    }

    static generatePolylineFromCoordinates(startPoint, endPoint, waypoints = []) {
        const coordinates = [startPoint];

        // Add waypoints in sequence order
        waypoints
            .sort((a, b) => a.sequence_order - b.sequence_order)
            .forEach(waypoint => {
                coordinates.push(waypoint.geopoint);
            });

        coordinates.push(endPoint);

        return `polyline_${coordinates.length}_points`;
    }

    static calculateWaypointTimes(departureTime, waypoints, estimatedArrivalTime) {
        if (!waypoints || waypoints.length === 0) return waypoints;

        const totalTripDuration = new Date(estimatedArrivalTime) - new Date(departureTime);
        const segmentDuration = totalTripDuration / (waypoints.length + 1);

        return waypoints.map((waypoint, index) => {
            if (!waypoint.estimated_arrival_time) {
                const estimatedTime = new Date(
                    new Date(departureTime).getTime() + (segmentDuration * (index + 1))
                );
                waypoint.estimated_arrival_time = estimatedTime.toISOString();
            }
            return waypoint;
        });
    }

    static async updateTripStatus(tripId, status) {
        try {
            return await Trip.updateByStatus(tripId, status);
        } catch (err) {
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
            if (filters.start_location && typeof filters.start_location === 'object') {
                if (filters.start_location.lat && filters.start_location.lng) {
                    filters.start_location = `POINT(${filters.start_location.lng} ${filters.start_location.lat})`;
                }
            }

            if (filters.end_location && typeof filters.end_location === 'object') {
                if (filters.end_location.lat && filters.end_location.lng) {
                    filters.end_location = `POINT(${filters.end_location.lng} ${filters.end_location.lat})`;
                }
            }

            return await Trip.findAll(filters);
        } catch (err) {
            throw err;
        }
    }

    static async searchTripsByRoute(startLocation, endLocation, filters = {}) {
        try {
            let processedStartLocation = startLocation;
            let processedEndLocation = endLocation;

            if (typeof startLocation === 'object' && startLocation.lat && startLocation.lng) {
                processedStartLocation = `POINT(${startLocation.lng} ${startLocation.lat})`;
            }

            if (typeof endLocation === 'object' && endLocation.lat && endLocation.lng) {
                processedEndLocation = `POINT(${endLocation.lng} ${endLocation.lat})`;
            }

            const trips = await Trip.findByRoute(processedStartLocation, processedEndLocation, filters.radius_km || 50, filters);
            return trips;
        } catch (err) {
            throw err;
        }
    }
}

module.exports = TripService;