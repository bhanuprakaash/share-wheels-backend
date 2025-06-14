const {db} = require("../config/db");
const Waypoint = require("../models/waypoint.model");

class Trip {
    static async create(tripData, waypoints = []) {
        try {
            return await db.tx(async t => {
                const tripQuery = `
                    INSERT INTO trips (driver_id, vehicle_id, start_location_name, start_address_line1, start_geopoint,
                                       end_location_name, end_address_line1, end_geopoint, departure_time,
                                       estimated_arrival_time, available_seats, price_per_seat, trip_status,
                                       trip_description, polyline_path)
                    VALUES ($1, $2, $3, $4, ST_GeogFromText($5), $6, $7, ST_GeogFromText($8), $9, $10,
                            $11, $12, $13, $14, $15)
                    RETURNING *
                `;
                const trip = await t.one(tripQuery, [
                    tripData.driver_id,
                    tripData.vehicle_id,
                    tripData.start_location_name,
                    tripData.start_address_line1,
                    tripData.start_geopoint,
                    tripData.end_location_name,
                    tripData.end_address_line1,
                    tripData.end_geopoint,
                    tripData.departure_time,
                    tripData.estimated_arrival_time,
                    tripData.available_seats,
                    tripData.price_per_seat,
                    tripData.trip_status || 'SCHEDULED',
                    tripData.trip_description,
                    tripData.polyline_path
                ]);

                let createdWaypoints = [];
                if (waypoints && waypoints.length > 0) {
                    for (const waypoint of waypoints) {
                        const waypointQuery = `
                            INSERT INTO trip_waypoints (trip_id, location_name, address_line1, geopoint,
                                                        sequence_order, estimated_arrival_time)
                            VALUES ($1, $2, $3, ST_GeogFromText($4), $5, $6)
                            RETURNING *
                        `;

                        const createdWaypoint = await t.one(waypointQuery, [
                            trip.trip_id,
                            waypoint.location_name,
                            waypoint.address_line1,
                            waypoint.geopoint, // Expected as 'POINT(lng lat)'
                            waypoint.sequence_order,
                            waypoint.estimated_arrival_time
                        ]);

                        createdWaypoints.push(createdWaypoint);
                    }
                }

                return {
                    trip,
                    waypoints: createdWaypoints
                }
            });
        } catch (error) {
            throw error;
        }
    }

    static async findById(tripId) {
        try {
            const tripQuery = `
                SELECT t.*,
                       ST_AsText(t.start_geopoint)                       as start_geopoint_text,
                       ST_AsText(t.end_geopoint)                         as end_geopoint_text,
                       u.first_name || ' ' || u.last_name                as driver_name,
                       u.phone_number                                    as driver_phone,
                       v.make || ' ' || v.model || ' (' || v.year || ')' as vehicle_info
                FROM trips t
                         LEFT JOIN users u ON t.driver_id = u.user_id
                         LEFT JOIN vehicles v ON t.vehicle_id = v.vehicle_id
                WHERE t.trip_id = $1
            `;

            const waypointsQuery = `
                SELECT *, ST_AsText(geopoint) as geopoint_text
                FROM trip_waypoints
                WHERE trip_id = $1
                ORDER BY sequence_order ASC
            `;

            const trip = await db.oneOrNone(tripQuery, [tripId]);
            if (!trip) return null;

            const waypoints = await db.any(waypointsQuery, [tripId]);

            return {
                ...trip,
                waypoints
            };
        } catch (error) {
            throw error;
        }
    }

    static async update(tripId, tripData, waypoints = []) {
        try {
            return await db.tx(async t => {
                const query = `SELECT trip_id, trip_status
                               FROM trips
                               WHERE trip_id = $1`;
                const existingTrip = await t.oneOrNone(query, [tripId]);
                if (!existingTrip) {
                    throw new Error("Trip Not Found");
                }
                if (existingTrip.trip_status === 'IN_PROGRESS' || existingTrip.trip_status === 'COMPLETED') {
                    throw new Error("Cant update status that it is in progress or completed");
                }

                const updateFields = [];
                const updateValues = [];
                let paramIndex = 1;

                if (tripData.vehicle_id !== undefined) {
                    updateFields.push(`vehicle_id = $${paramIndex++}`);
                    updateValues.push(tripData.vehicle_id);
                }
                if (tripData.start_location_name !== undefined) {
                    updateFields.push(`start_location_name = $${paramIndex++}`);
                    updateValues.push(tripData.start_location_name);
                }
                if (tripData.start_address_line1 !== undefined) {
                    updateFields.push(`start_address_line1 = $${paramIndex++}`);
                    updateValues.push(tripData.start_address_line1);
                }
                if (tripData.start_geopoint !== undefined) {
                    updateFields.push(`start_geopoint = ST_GeogFromText($${paramIndex++})`);
                    updateValues.push(tripData.start_geopoint);
                }
                if (tripData.end_location_name !== undefined) {
                    updateFields.push(`end_location_name = $${paramIndex++}`);
                    updateValues.push(tripData.end_location_name);
                }
                if (tripData.end_address_line1 !== undefined) {
                    updateFields.push(`end_address_line1 = $${paramIndex++}`);
                    updateValues.push(tripData.end_address_line1);
                }
                if (tripData.end_geopoint !== undefined) {
                    updateFields.push(`end_geopoint = ST_GeogFromText($${paramIndex++})`);
                    updateValues.push(tripData.end_geopoint);
                }
                if (tripData.departure_time !== undefined) {
                    updateFields.push(`departure_time = $${paramIndex++}`);
                    updateValues.push(tripData.departure_time);
                }
                if (tripData.estimated_arrival_time !== undefined) {
                    updateFields.push(`estimated_arrival_time = $${paramIndex++}`);
                    updateValues.push(tripData.estimated_arrival_time);
                }
                if (tripData.available_seats !== undefined) {
                    updateFields.push(`available_seats = $${paramIndex++}`);
                    updateValues.push(tripData.available_seats);
                }
                if (tripData.price_per_seat !== undefined) {
                    updateFields.push(`price_per_seat = $${paramIndex++}`);
                    updateValues.push(tripData.price_per_seat);
                }
                if (tripData.trip_description !== undefined) {
                    updateFields.push(`trip_description = $${paramIndex++}`);
                    updateValues.push(tripData.trip_description);
                }
                if (tripData.polyline_path !== undefined) {
                    updateFields.push(`polyline_path = $${paramIndex++}`);
                    updateValues.push(tripData.polyline_path);
                }

                updateFields.push(`updated_at = NOW()`);

                if (updateFields.length === 1) {
                    throw new Error('No fields to update');
                }

                updateValues.push(tripId);

                const updateQuery = `
                    UPDATE trips
                    SET ${updateFields.join(', ')}
                    WHERE trip_id = $${paramIndex}
                RETURNING *
            `;

                const updatedTrip = await t.one(updateQuery, updateValues);

                let updatedWaypoints = [];
                if (waypoints !== undefined) {
                    const existingWaypoints = await t.any('SELECT waypoint_id, sequence_order FROM trip_waypoints WHERE trip_id = $1', [tripId]);
                    const existingWaypointIds = new Set(existingWaypoints.map(wp => wp.waypoint_id));
                    const existingWaypointMap = new Map(existingWaypoints.map(wp => [wp.waypoint_id, wp]));

                    const newWaypointIds = new Set(waypoints.filter(wp => wp.waypoint_id).map(wp => wp.waypoint_id));

                    for (const existingWp of existingWaypoints) {
                        if (!newWaypointIds.has(existingWp.waypoint_id)) {
                            await t.none('DELETE FROM trip_waypoints WHERE waypoint_id = $1', [existingWp.waypoint_id]);
                        }
                    }

                    for (const waypointData of waypoints) {
                        if (waypointData.waypoint_id) {
                            if (existingWaypointIds.has(waypointData.waypoint_id)) {
                                const updatedWp = await Waypoint.update(t, waypointData.waypoint_id, waypointData);
                                if (updatedWp) {
                                    updatedWaypoints.push(updatedWp);
                                }
                            } else {
                                const createdWaypoint = await Waypoint.addToTrip(t, tripId, waypointData);
                                updatedWaypoints.push(createdWaypoint);
                            }
                        } else {
                            const createdWaypoint = await Waypoint.addToTrip(t, tripId, waypointData);
                            updatedWaypoints.push(createdWaypoint);
                        }
                    }
                    const finalWaypointsQuery = `
                        SELECT *, ST_AsText(geopoint) as geopoint_text
                        FROM trip_waypoints
                        WHERE trip_id = $1
                        ORDER BY sequence_order ASC
                    `;
                    updatedWaypoints = await t.any(finalWaypointsQuery, [tripId]);
                } else {
                    const waypointsQuery = `
                        SELECT *, ST_AsText(geopoint) as geopoint_text
                        FROM trip_waypoints
                        WHERE trip_id = $1
                        ORDER BY sequence_order ASC
                    `;
                    updatedWaypoints = await t.any(waypointsQuery, [tripId]);
                }

                return {
                    trip: updatedTrip,
                    waypoints: updatedWaypoints
                }
            });
        } catch (err) {
            throw err;
        }
    }

    static async updateByStatus(tripId, status) {
        try {
            const validStatuses = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

            if (!validStatuses.includes(status)) {
                throw new Error('Invalid trip status');
            }

            const updateData = {trip_status: status};

            if (status === 'IN_PROGRESS') {
                updateData.actual_start_time = 'NOW()';
            } else if (status === 'COMPLETED') {
                updateData.actual_end_time = 'NOW()';
            }

            let query = `
                UPDATE trips
                SET trip_status = $1,
                    updated_at  = NOW()
            `;
            let params = [status];

            if (status === 'IN_PROGRESS') {
                query += ', actual_start_time = COALESCE(actual_start_time, NOW())';
            } else if (status === 'COMPLETED') {
                query += ', actual_end_time = COALESCE(actual_end_time, NOW())';
            }

            query += ' WHERE trip_id = $2 RETURNING *';
            params.push(tripId);

            const updatedTrip = await db.one(query, params);
            return updatedTrip;
        } catch (err) {
            throw err;
        }
    }

    static async delete(tripId) {
        try {
            const trip = await db.oneOrNone(
                'SELECT trip_id, trip_status FROM trips WHERE trip_id = $1',
                [tripId]
            );
            if (!trip) {
                throw new Error("Trip Not Found");
            }
            if (trip.trip_status === "IN_PROGRESS") {
                throw new Error('Cannot delete trip that is in progress');
            }
            const deletedTrip = await db.one(
                'DELETE FROM trips WHERE trip_id = $1 RETURNING *',
                [tripId]
            );
            return deletedTrip

        } catch (err) {
            throw err;
        }
    }

    static async findAll(filters = {}) {
        try {
            const {
                driver_id,
                trip_status,
                departure_date,
                limit = 20,
                offset = 0,
                start_location,
                end_location,
                radius_km = 50
            } = filters;

            let baseQuery = `
                SELECT DISTINCT t.*,
                                ST_AsText(t.start_geopoint)                       as start_geopoint_text,
                                ST_AsText(t.end_geopoint)                         as end_geopoint_text,
                                u.first_name || ' ' || u.last_name                as driver_name,
                                u.phone_number                                    as driver_phone,
                                v.make || ' ' || v.model || ' (' || v.year || ')' as vehicle_info
                FROM trips t
                         LEFT JOIN users u ON t.driver_id = u.user_id
                         LEFT JOIN vehicles v ON t.vehicle_id = v.vehicle_id
            `;

            const locationJoins = [];
            const params = [];
            let paramIndex = 1;

            if (start_location) {
                locationJoins.push(`
            LEFT JOIN (
                SELECT trip_id, 'start' as match_type, 0 as waypoint_sequence FROM trips 
                WHERE ST_DWithin(start_geopoint, ST_GeogFromText($${paramIndex}), $${paramIndex + 1})
                UNION
                SELECT trip_id, 'waypoint_start' as match_type, sequence_order as waypoint_sequence FROM trip_waypoints 
                WHERE ST_DWithin(geopoint, ST_GeogFromText($${paramIndex}), $${paramIndex + 1})
            ) start_matches ON t.trip_id = start_matches.trip_id
        `);
                params.push(start_location, radius_km * 1000);
                paramIndex += 2;
            }

            if (end_location) {
                locationJoins.push(`
            LEFT JOIN (
                SELECT trip_id, 'end' as match_type, 999 as waypoint_sequence FROM trips 
                WHERE ST_DWithin(end_geopoint, ST_GeogFromText($${paramIndex}), $${paramIndex + 1})
                UNION
                SELECT trip_id, 'waypoint_end' as match_type, sequence_order as waypoint_sequence FROM trip_waypoints 
                WHERE ST_DWithin(geopoint, ST_GeogFromText($${paramIndex}), $${paramIndex + 1})
            ) end_matches ON t.trip_id = end_matches.trip_id
        `);
                params.push(end_location, radius_km * 1000);
                paramIndex += 2;
            }

            // Add location joins to query
            let query = baseQuery + locationJoins.join(' ');

            // Add match_type and waypoint sequence columns
            if (start_location || end_location) {
                let caseConditions = [];
                if (start_location) {
                    caseConditions.push("WHEN start_matches.match_type = 'start' THEN 'start'");
                    caseConditions.push("WHEN start_matches.match_type = 'waypoint_start' THEN 'waypoint_start'");
                }
                if (end_location) {
                    caseConditions.push("WHEN end_matches.match_type = 'end' THEN 'end'");
                    caseConditions.push("WHEN end_matches.match_type = 'waypoint_end' THEN 'waypoint_end'");
                }

                const caseStatement = `CASE ${caseConditions.join(' ')} ELSE 'exact' END as match_type`;
                const startSequence = start_location ? 'start_matches.waypoint_sequence' : '0';
                const endSequence = end_location ? 'end_matches.waypoint_sequence' : '999';

                query = query.replace(
                    'v.make || \' \' || v.model || \' (\' || v.year || \')\' as vehicle_info',
                    `v.make || ' ' || v.model || ' (' || v.year || ')' as vehicle_info, 
                 ${caseStatement},
                 ${startSequence} as start_sequence,
                 ${endSequence} as end_sequence`
                );
            } else {
                query = query.replace(
                    'v.make || \' \' || v.model || \' (\' || v.year || \')\' as vehicle_info',
                    `v.make || ' ' || v.model || ' (' || v.year || ')' as vehicle_info, 
                 'exact' as match_type,
                 0 as start_sequence,
                 999 as end_sequence`
                );
            }

            // Add WHERE conditions
            query += ' WHERE 1=1';

            if (driver_id) {
                query += ` AND t.driver_id = $${paramIndex}`;
                params.push(driver_id);
                paramIndex++;
            }

            if (trip_status) {
                query += ` AND t.trip_status = $${paramIndex}`;
                params.push(trip_status);
                paramIndex++;
            }

            if (departure_date) {
                query += ` AND DATE(t.departure_time) = $${paramIndex}`;
                params.push(departure_date);
                paramIndex++;
            }

            // Location filtering logic with SEQUENCE ORDER VALIDATION
            if (start_location && end_location) {
                query += ` AND (
            -- Exact start to exact end
            (start_matches.match_type = 'start' AND end_matches.match_type = 'end') OR
            
            -- Start to waypoint (end)
            (start_matches.match_type = 'start' AND end_matches.match_type = 'waypoint_end') OR
            
            -- Waypoint (start) to exact end
            (start_matches.match_type = 'waypoint_start' AND end_matches.match_type = 'end') OR
            
            -- Waypoint to waypoint WITH SEQUENCE VALIDATION
            (start_matches.match_type = 'waypoint_start' AND end_matches.match_type = 'waypoint_end' 
             AND EXISTS (
                 SELECT 1 FROM trip_waypoints tw_start, trip_waypoints tw_end 
                 WHERE tw_start.trip_id = t.trip_id 
                 AND tw_end.trip_id = t.trip_id
                 AND ST_DWithin(tw_start.geopoint, ST_GeogFromText($${paramIndex}), $${paramIndex + 1})
                 AND ST_DWithin(tw_end.geopoint, ST_GeogFromText($${paramIndex + 2}), $${paramIndex + 3})
                 AND tw_start.sequence_order < tw_end.sequence_order
             ))
        )`;
                params.push(start_location, radius_km * 1000, end_location, radius_km * 1000);
                paramIndex += 4;
            } else if (start_location) {
                query += ` AND start_matches.trip_id IS NOT NULL`;
            } else if (end_location) {
                query += ` AND end_matches.trip_id IS NOT NULL`;
            }

            query += ` ORDER BY t.departure_time ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(limit, offset);

            const trips = await db.any(query, params);

            // Get waypoints and calculate segment pricing for each trip
            const tripsWithWaypoints = await Promise.all(
                trips.map(async (trip) => {
                    const waypoints = await db.any(`
                        SELECT waypoint_id,
                               location_name,
                               address_line1,
                               sequence_order,
                               ST_AsText(geopoint) as geopoint_text,
                               estimated_arrival_time,
                               actual_arrival_time
                        FROM trip_waypoints
                        WHERE trip_id = $1
                        ORDER BY sequence_order ASC
                    `, [trip.trip_id]);

                    const enhancedTrip = {
                        ...trip,
                        waypoints
                    };

                    // Calculate segment-specific information
                    if (start_location || end_location) {
                        const segmentInfo = this.calculateSegmentInfo(enhancedTrip, start_location, end_location);
                        enhancedTrip.segment_info = segmentInfo;
                    }

                    return enhancedTrip;
                })
            );

            return tripsWithWaypoints;
        } catch (error) {
            console.error('Error in findAll:', error);
            throw error;
        }
    }

    static calculateSegmentInfo(trip, startLocation, endLocation) {
        const startSequence = trip.start_sequence || 0;
        const endSequence = trip.end_sequence === 999 ? 999 : trip.end_sequence;

        // Find actual start and end points for display
        let actualStartPoint, actualEndPoint;

        if (startSequence === 0) {
            actualStartPoint = {
                location_name: trip.start_location_name,
                address_line1: trip.start_address_line1,
                geopoint_text: trip.start_geopoint_text
            };
        } else {
            actualStartPoint = trip.waypoints.find(w => w.sequence_order === startSequence);
        }

        if (endSequence === 999) {
            actualEndPoint = {
                location_name: trip.end_location_name,
                address_line1: trip.end_address_line1,
                geopoint_text: trip.end_geopoint_text
            };
        } else {
            actualEndPoint = trip.waypoints.find(w => w.sequence_order === endSequence);
        }

        // Calculate segment price (proportional to total trip)
        // Total segments = waypoints + 1 (final destination)
        const totalWaypoints = trip.waypoints.length;
        const totalSegments = totalWaypoints + 1;

        // Calculate how many segments this user will travel
        let segmentCount;
        if (endSequence === 999) {
            // From waypoint to final destination
            segmentCount = totalSegments - startSequence;
        } else if (startSequence === 0) {
            // From start to waypoint
            segmentCount = endSequence;
        } else {
            // From waypoint to waypoint
            segmentCount = endSequence - startSequence;
        }

        const segmentRatio = segmentCount / totalSegments;
        const basePricePerSeat = parseFloat(trip.price_per_seat || trip.base_price || 0);
        const segmentPrice = Math.round(basePricePerSeat * segmentRatio);

        // Calculate estimated duration for segment
        const departureTime = new Date(trip.departure_time);
        const arrivalTime = new Date(trip.estimated_arrival_time);
        const totalDurationMinutes = (arrivalTime - departureTime) / (1000 * 60);
        const segmentDuration = Math.round(totalDurationMinutes * segmentRatio);

        return {
            actual_start_point: actualStartPoint,
            actual_end_point: actualEndPoint,
            segment_price: segmentPrice,
            segment_duration_minutes: segmentDuration,
            is_partial_trip: startSequence > 0 || endSequence < 999,
            start_sequence: startSequence,
            end_sequence: endSequence,
            segment_ratio: segmentRatio,
            total_segments: totalSegments,
            segment_count: segmentCount
        };
    }

    static async findByRoute(startLocation, endLocation, radius_km = 50, filters = {}) {
        try {
            const {
                driver_id,
                trip_status,
                departure_date,
                limit = 20,
                offset = 0
            } = filters;

            // Validate required parameters
            if (!startLocation || !endLocation) {
                throw new Error('Both startLocation and endLocation are required for route search');
            }

            let query = `
                SELECT DISTINCT t.*,
                                ST_AsText(t.start_geopoint)                        as start_geopoint_text,
                                ST_AsText(t.end_geopoint)                          as end_geopoint_text,
                                u.first_name || ' ' || u.last_name                 as driver_name,
                                u.phone_number                                     as driver_phone,
                                v.make || ' ' || v.model || ' (' || v.year || ')'  as vehicle_info,
                                CASE
                                    WHEN start_exact.trip_id IS NOT NULL AND end_exact.trip_id IS NOT NULL
                                        THEN 'exact_route'
                                    WHEN start_waypoint.trip_id IS NOT NULL AND end_waypoint.trip_id IS NOT NULL
                                        THEN 'waypoint_route'
                                    WHEN start_exact.trip_id IS NOT NULL AND end_waypoint.trip_id IS NOT NULL
                                        THEN 'mixed_start_exact'
                                    WHEN start_waypoint.trip_id IS NOT NULL AND end_exact.trip_id IS NOT NULL
                                        THEN 'mixed_end_exact'
                                    ELSE 'partial_match'
                                    END                                            as route_match_type,
                                ST_Distance(t.start_geopoint, ST_GeogFromText($1)) as start_distance_meters,
                                ST_Distance(t.end_geopoint, ST_GeogFromText($2))   as end_distance_meters
                FROM trips t
                         LEFT JOIN users u ON t.driver_id = u.user_id
                         LEFT JOIN vehicles v ON t.vehicle_id = v.vehicle_id
            `;

            const params = [startLocation, endLocation];
            let paramIndex = 3;

            // Add subqueries for start location matching (exact trip start points)
            query += `
            LEFT JOIN (
                SELECT trip_id 
                FROM trips 
                WHERE ST_DWithin(start_geopoint, ST_GeogFromText($1), $${paramIndex++})
            ) start_exact ON t.trip_id = start_exact.trip_id
        `;
            params.push(radius_km * 1000);

            // Add subqueries for start location matching (waypoints)
            query += `
            LEFT JOIN (
                SELECT trip_id 
                FROM trip_waypoints 
                WHERE ST_DWithin(geopoint, ST_GeogFromText($1), $${paramIndex++})
            ) start_waypoint ON t.trip_id = start_waypoint.trip_id
        `;
            params.push(radius_km * 1000);

            // Add subqueries for end location matching (exact trip end points)
            query += `
            LEFT JOIN (
                SELECT trip_id 
                FROM trips 
                WHERE ST_DWithin(end_geopoint, ST_GeogFromText($2), $${paramIndex++})
            ) end_exact ON t.trip_id = end_exact.trip_id
        `;
            params.push(radius_km * 1000);

            // Add subqueries for end location matching (waypoints)
            query += `
            LEFT JOIN (
                SELECT trip_id 
                FROM trip_waypoints 
                WHERE ST_DWithin(geopoint, ST_GeogFromText($2), $${paramIndex++})
            ) end_waypoint ON t.trip_id = end_waypoint.trip_id
        `;
            params.push(radius_km * 1000);

            // Add WHERE conditions - must match both start and end locations
            query += `
            WHERE (
                (start_exact.trip_id IS NOT NULL AND end_exact.trip_id IS NOT NULL) OR
                (start_waypoint.trip_id IS NOT NULL AND end_waypoint.trip_id IS NOT NULL) OR
                (start_exact.trip_id IS NOT NULL AND end_waypoint.trip_id IS NOT NULL) OR
                (start_waypoint.trip_id IS NOT NULL AND end_exact.trip_id IS NOT NULL)
            )
        `;

            // Add additional filters
            if (driver_id) {
                query += ` AND t.driver_id = $${paramIndex++}`;
                params.push(driver_id);
            }

            if (trip_status) {
                query += ` AND t.trip_status = $${paramIndex++}`;
                params.push(trip_status);
            }

            if (departure_date) {
                query += ` AND DATE(t.departure_time) = $${paramIndex++}`;
                params.push(departure_date);
            }

            // Order by best matches first (exact routes, then by departure time)
            query += `
            ORDER BY 
                CASE route_match_type
                    WHEN 'exact_route' THEN 1
                    WHEN 'waypoint_route' THEN 2
                    WHEN 'mixed_start_exact' THEN 3
                    WHEN 'mixed_end_exact' THEN 4
                    ELSE 5
                END,
                (start_distance_meters + end_distance_meters) ASC,
                t.departure_time ASC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
            params.push(limit, offset);

            const trips = await db.any(query, params);

            // For each trip, get its waypoints for route context
            const tripsWithWaypoints = await Promise.all(
                trips.map(async (trip) => {
                    const waypoints = await db.any(`
                        SELECT waypoint_id,
                               location_name,
                               address_line1,
                               sequence_order,
                               ST_AsText(geopoint)                        as geopoint_text,
                               estimated_arrival_time,
                               actual_arrival_time,
                               ST_Distance(geopoint, ST_GeogFromText($1)) as distance_from_start,
                               ST_Distance(geopoint, ST_GeogFromText($2)) as distance_from_end
                        FROM trip_waypoints
                        WHERE trip_id = $3
                        ORDER BY sequence_order ASC
                    `, [startLocation, endLocation, trip.trip_id]);

                    return {
                        ...trip,
                        waypoints,
                        route_summary: {
                            start_distance_km: Math.round(trip.start_distance_meters / 1000 * 100) / 100,
                            end_distance_km: Math.round(trip.end_distance_meters / 1000 * 100) / 100,
                            total_route_deviation: Math.round((trip.start_distance_meters + trip.end_distance_meters) / 1000 * 100) / 100
                        }
                    };
                })
            );

            return {
                trips: tripsWithWaypoints,
                search_criteria: {
                    start_location: startLocation,
                    end_location: endLocation,
                    radius_km: radius_km,
                    filters: filters
                },
                total_found: tripsWithWaypoints.length
            };

        } catch (error) {
            throw error;
        }
    }
}

module.exports = Trip;