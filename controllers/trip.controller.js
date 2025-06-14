const TripService = require("../services/trip.service");

const TripController = {
    async createTrip(req, res, next) {
        try {
            const {waypoints, ...tripData} = req.body;

            if (!tripData.polyline_path && waypoints) {
                tripData.polyline_path = TripService.generatePolylineFromCoordinates(
                    tripData.start_geopoint,
                    tripData.end_geopoint,
                    waypoints
                );
            }

            const processedWaypoints = waypoints ?
                TripService.calculateWaypointTimes(
                    tripData.departure_time,
                    waypoints,
                    tripData.estimated_arrival_time
                ) : [];

            const result = await TripService.createTrip(tripData, processedWaypoints);

            res.status(201).json({
                success: true,
                message: "Trip Created Successfully",
                data: {trip: result.trip, waypoints: result.waypoints}
            })

        } catch (err) {
            next(err);
        }
    },

    async getTripById(req, res, next) {
        try {
            const {tripId} = req.params;
            const result = await TripService.getTripById(tripId);
            return res.status(200).json({
                success: true,
                data: result
            });
        } catch (err) {
            next(err);
        }
    },

    async updateTrip(req, res, next) {
        try {
            const {tripId} = req.params;
            const {waypoints, ...tripData} = req.body;

            // Regenerate polyline if coordinates changed
            if (!tripData.polyline_path && (tripData.start_geopoint || tripData.end_geopoint || waypoints)) {
                const currentTrip = await TripService.getTripById(tripId);
                const startPoint = tripData.start_geopoint || currentTrip.start_geopoint_text;
                const endPoint = tripData.end_geopoint || currentTrip.end_geopoint_text;
                const waypointsToUse = waypoints || currentTrip.waypoints || [];

                tripData.polyline_path = TripService.generatePolylineFromCoordinates(
                    startPoint,
                    endPoint,
                    waypointsToUse
                );
            }

            // Process waypoints timing
            const processedWaypoints = waypoints ?
                TripService.calculateWaypointTimes(
                    tripData.departure_time,
                    waypoints,
                    tripData.estimated_arrival_time
                ) : waypoints;

            const result = await TripService.updateTrip(tripId, tripData, processedWaypoints);

            res.status(200).json({
                success: true,
                message: "Trip updated successfully",
                data: result
            });

        } catch (err) {
            next(err);
        }
    },

    async updateTripStatus(req, res, next) {
        try {
            const {tripId} = req.params;
            const {status} = req.body;

            if (!status) {
                return res.status(400).json({
                    success: false,
                    message: "Status is required"
                });
            }

            const result = await TripService.updateTripStatus(tripId, status);

            res.status(200).json({
                success: true,
                message: "Trip status updated successfully",
                data: result
            });

        } catch (err) {
            next(err);
        }
    },

    async deleteTrip(req, res, next) {
        try {
            const {tripId} = req.params;

            const result = await TripService.deleteTrip(tripId);

            res.status(200).json({
                success: true,
                message: "Trip deleted successfully",
                data: result
            });

        } catch (err) {
            next(err);
        }
    },

    async getAllTrips(req, res, next) {
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
                radius_km = 50
            } = req.query;

            const filters = {
                driver_id,
                trip_status,
                departure_date,
                limit: parseInt(limit),
                offset: parseInt(offset),
                radius_km: parseInt(radius_km)
            };

            // Convert lat/lng to POINT format for filtering
            if (start_lat && start_lng) {
                filters.start_location = {lat: parseFloat(start_lat), lng: parseFloat(start_lng)};
            }

            if (end_lat && end_lng) {
                filters.end_location = {lat: parseFloat(end_lat), lng: parseFloat(end_lng)};
            }

            const trips = await TripService.getAllTrips(filters);

            res.status(200).json({
                success: true,
                data: trips,
                pagination: {
                    limit: filters.limit,
                    offset: filters.offset,
                    total: trips.length
                }
            });

        } catch (err) {
            next(err);
        }
    }

}

module.exports = TripController;