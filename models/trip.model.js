const { tripColumnSet, waypointsColumnSet } = require('../config/db');

class Trip {
  constructor(dbClient, pgp, waypointRespository) {
    this.db = dbClient;
    this.pgp = pgp;
    this.waypointRespository = waypointRespository;
  }

  async create(tripData, waypoints = []) {
    try {
      return await this.db.tx(async (t) => {
        const tripQuery = `
          INSERT INTO trips (driver_id, vehicle_id, start_location_name, start_address_line1, start_geopoint,
                             end_location_name, end_address_line1, end_geopoint, departure_time,
                             estimated_arrival_time, available_seats, price_per_seat, trip_status,
                             trip_description)
          VALUES ($1, $2, $3, $4, st_geomfromtext($5, 4326)::geography, $6, $7,
                  st_geomfromtext($8, 4326)::geography, $9, $10,
                  $11, $12, $13, $14)
          RETURNING
            trip_id,
            driver_id,
            vehicle_id,
            start_location_name,
            start_address_line1,
            json_build_object(
              'lat', ST_Y(start_geopoint::geometry),
              'lng', ST_X(start_geopoint::geometry)
            ) AS start_geopoint,
            end_location_name,
            end_address_line1,
            json_build_object(
              'lat', ST_Y(end_geopoint::geometry),
              'lng', ST_X(end_geopoint::geometry)
            ) AS end_geopoint,
            departure_time,
            estimated_arrival_time,
            available_seats,
            price_per_seat,
            trip_status,
            trip_description,
            created_at,
            updated_at
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
        ]);

        let createdWaypoints = await this._insertTripWaypointsBatch(
          t,
          trip.trip_id,
          waypoints
        );

        const polyline = await this._generateAndSaveTripPolyline(
          t,
          trip.trip_id
        );
        return {
          trip: {
            ...trip,
            polyline_path: polyline.polyline_path,
          },
          waypoints: createdWaypoints,
        };
      });
    } catch (error) {
      throw error;
    }
  }

  async findById(tripId) {
    try {
      const tripQuery = `
        SELECT t.trip_id,
               t.driver_id,
               t.vehicle_id,
               t.start_location_name,
               t.start_address_line1,
               json_build_object(
                 'lat', ST_Y(start_geopoint::geometry),
                 'lng', ST_X(start_geopoint::geometry)
               )                          AS start_geopoint,
               t.end_location_name,
               t.end_address_line1,
               json_build_object(
                 'lat', ST_Y(end_geopoint::geometry),
                 'lng', ST_X(end_geopoint::geometry)
               )                          AS end_geopoint,
               t.departure_time,
               t.estimated_arrival_time,
               t.available_seats,
               t.price_per_seat,
               t.trip_status,
               t.trip_description,
               t.actual_start_time,
               t.actual_end_time,
               t.created_at,
               t.updated_at,
               ST_AsText(t.polyline_path) as polyline_path
        FROM trips t
        WHERE t.trip_id = $1
      `;
      const waypointsQuery = `
        SELECT waypoint_id,
               trip_id,
               location_name,
               address_line1,
               json_build_object(
               'lat', ST_Y(geopoint::geometry),
               'lng', ST_X(geopoint::geometry)
               ) as geopoint,
               sequence_order,
               estimated_arrival_time,
               actual_arrival_time
        FROM trip_waypoints
        WHERE trip_id = $1
        ORDER BY sequence_order
      `;
      const trip = await this.db.oneOrNone(tripQuery, [tripId]);
      if (!trip) return null;

      const waypoints = await this.db.any(waypointsQuery, [tripId]);

      return {
        ...trip,
        waypoints,
      };
    } catch (error) {
      throw error;
    }
  }

  async update(tripId, tripData, waypoints = []) {
    try {
      return await this.db.tx(async (t) => {
        const existingTrip = await t.oneOrNone(
          `SELECT trip_id, trip_status
           FROM trips
           WHERE trip_id = $1`,
          [tripId]
        );
        if (!existingTrip) {
          throw new Error('Trip Not Found');
        }

        if (['IN_PROGRESS', 'COMPLETED'].includes(existingTrip.trip_status)) {
          throw new Error(
            'Cant update status that it is in progress or completed'
          );
        }

        const dataToUpdate = {};
        let hasUpdates = false;

        for (const key in tripData) {
          if (
            tripColumnSet.columns.some(
              (col) => col.name === key || (col.prop && col.prop === key)
            ) &&
            tripData[key] !== undefined
          ) {
            dataToUpdate[key] = tripData[key];
            hasUpdates = true;
          }
        }

        if (hasUpdates) {
          dataToUpdate.updated_at = this.pgp.as.date(new Date());
        } else {
          throw new Error('No fields to update in trip data');
        }

        const condition = this.pgp.as.format('WHERE trip_id = ${tripId}', {
          tripId,
        });

        const updateQuery =
          this.pgp.helpers.update(dataToUpdate, null, 'trips') +
          condition +
          `RETURNING trip_id,
            driver_id,
            vehicle_id,
            start_location_name,
            start_address_line1,
            json_build_object(
              'lat', ST_Y(start_geopoint::geometry),
              'lng', ST_X(start_geopoint::geometry)
            ) AS start_geopoint,
            end_location_name,
            end_address_line1,
            json_build_object(
              'lat', ST_Y(end_geopoint::geometry),
              'lng', ST_X(end_geopoint::geometry)
            ) AS end_geopoint,
            departure_time,
            estimated_arrival_time,
            available_seats,
            price_per_seat,
            trip_status,
            trip_description,
            created_at,
            updated_at`;

        const updatedTrip = await t.one(updateQuery);

        await t.none(
          `DELETE
           FROM trip_waypoints
           WHERE trip_id = $1`,
          [tripId]
        );

        const updatedWaypoints = await this._insertTripWaypointsBatch(
          t,
          tripId,
          waypoints
        );

        const polyline = await this._generateAndSaveTripPolyline(t, tripId);
        return {
          ...updatedTrip,
          polyline_path: polyline.polyline_path,
          waypoints: updatedWaypoints,
        };
      });
    } catch (err) {
      throw err;
    }
  }

  async updateByStatus(tripId, status, transaction = this.db) {
    try {
      const validStatuses = [
        'SCHEDULED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
      ];

      if (!validStatuses.includes(status)) {
        throw new Error('Invalid trip status');
      }

      const updateData = { trip_status: status };

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

      query += ' WHERE trip_id = $2 RETURNING trip_id, trip_status';
      params.push(tripId);

      return await transaction.one(query, params);
    } catch (err) {
      throw err;
    }
  }

  async delete(tripId) {
    try {
      const trip = await this.db.oneOrNone(
        'SELECT trip_id, trip_status FROM trips WHERE trip_id = $1',
        [tripId]
      );
      if (!trip) {
        throw new Error('Trip Not Found');
      }
      if (trip.trip_status === 'IN_PROGRESS') {
        throw new Error('Cannot delete trip that is in progress');
      }
      return await this.db.one(
        'DELETE FROM trips WHERE trip_id = $1 RETURNING trip_id',
        [tripId]
      );
    } catch (err) {
      throw err;
    }
  }

  async findTripByDriverId(driverId) {
    try {
      const tripsQuery = `
        SELECT t.trip_id,
               t.driver_id,
               t.vehicle_id,
               t.start_location_name,
               t.start_address_line1,
               json_build_object(
                 'lat', ST_Y(t.start_geopoint::geometry),
                 'lng', ST_X(t.start_geopoint::geometry)
               )                          AS start_geopoint,
--                ST_AsText(t.start_geopoint) as start_geopoint,
               t.end_location_name,
               t.end_address_line1,
               json_build_object(
                 'lat', ST_Y(t.end_geopoint::geometry),
                 'lng', ST_X(t.end_geopoint::geometry)
               )                          AS end_geopoint,
               t.departure_time,
               t.estimated_arrival_time,
               t.available_seats,
               t.price_per_seat,
               t.trip_status,
               t.trip_description,
               t.actual_start_time,
               t.actual_end_time,
               t.created_at,
               t.updated_at,
               ST_AsText(t.polyline_path) as polyline_path
        FROM trips t
        WHERE t.driver_id = $1
        ORDER BY t.departure_time DESC;
      `;

      const waypointsQuery = `
        SELECT waypoint_id,
               trip_id,
               location_name,
               address_line1,
               json_build_object(
                 'lat', ST_Y(geopoint::geometry),
                 'lng', ST_X(geopoint::geometry)
               ) AS geopoint,
               sequence_order,
               estimated_arrival_time,
               actual_arrival_time
        FROM trip_waypoints
        WHERE trip_id = $1
        ORDER BY sequence_order;
      `;

      const trips = await this.db.any(tripsQuery, [driverId]);

      if (trips.length === 0) {
        return [];
      }

      return await Promise.all(
        trips.map(async (trip) => {
          const waypoints = await this.db.any(waypointsQuery, [trip.trip_id]);
          return {
            ...trip,
            waypoints,
          };
        })
      );
    } catch (error) {
      throw error;
    }
  }

  async getAvailableSeatsByTripId(transaction, tripId) {
    try {
      const query = `
        SELECT available_seats
        FROM trips
        WHERE trip_id = $1
      `;
      return await transaction.oneOrNone(query, [tripId]);
    } catch (err) {
      throw err;
    }
  }

  async updateSeatsInTrip(transaction, tripId, bookedSeats) {
    try {
      const query = `
        UPDATE trips
        SET available_seats = available_seats - $1
        WHERE trip_id = $2
          AND available_seats >= $3
        RETURNING available_seats,driver_id
      `;
      return await transaction.oneOrNone(query, [
        bookedSeats,
        tripId,
        bookedSeats,
      ]);
    } catch (err) {
      throw err;
    }
  }

  async findAll(filters = {}) {
    try {
      const {
        driver_id,
        trip_status,
        departure_date,
        limit = 20,
        offset = 0,
        start_location,
        end_location,
        radius_km = 50,
      } = filters;

      const { lat: startLat, lng: startLng } = this._validateCoordinates(
        start_location,
        'start_location'
      );
      let endLat = null;
      let endLng = null;
      if (end_location) {
        const validatedEndCoordinates = this._validateCoordinates(
          end_location,
          'end_location'
        );
        endLat = validatedEndCoordinates.lat;
        endLng = validatedEndCoordinates.lng;
      }

      const radiusDegrees = radius_km / 111.32;

      let query = `
        SELECT t.trip_id,
               t.driver_id,
               t.start_location_name,
               t.end_location_name,
               t.trip_status,
               t.departure_time,
               t.price_per_seat
        FROM trips t
        WHERE t.polyline_path IS NOT NULL
      `;

      const values = [];
      let paramIndex = 1;

      if (!end_location) {
        query += `
              AND t.polyline_path && ST_Envelope(
                    ST_Expand(ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326), $${paramIndex + 2})
                  )
              AND ST_DWithin(
                    t.polyline_path::geography,
                    ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography,
                    $${paramIndex + 3}
                  )
            `;
        values.push(startLng, startLat, radiusDegrees, radius_km * 1000);
        paramIndex += 4;
      } else {
        // Add bounding box check for both start and end locations
        query += `
              AND t.polyline_path && ST_Envelope(
                    ST_Collect(
                            ST_Expand(ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326), $${paramIndex + 4}),
                            ST_Expand(ST_SetSRID(ST_MakePoint($${paramIndex + 2}, $${paramIndex + 3}), 4326), $${paramIndex + 4})
                    )
                                     )
              AND ST_DWithin(
                    t.polyline_path::geography,
                    ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography,
                    $${paramIndex + 5}
                  )
              AND ST_DWithin(
                    t.polyline_path::geography,
                    ST_SetSRID(ST_MakePoint($${paramIndex + 2}, $${paramIndex + 3}), 4326)::geography,
                    $${paramIndex + 5}
                  )
              AND ST_LineLocatePoint(
                        t.polyline_path::geometry,
                        ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)
                ) <
                ST_LineLocatePoint(
                        t.polyline_path::geometry,
                        ST_SetSRID(ST_MakePoint($${paramIndex + 2}, $${paramIndex + 3}), 4326)
                )
            `;
        values.push(
          startLng,
          startLat,
          endLng,
          endLat,
          radiusDegrees,
          radius_km * 1000
        );
        paramIndex += 6;
      }

      // Add additional filters
      if (driver_id) {
        query += ` AND t.driver_id = $${paramIndex}`;
        values.push(driver_id);
        paramIndex++;
      }

      if (trip_status) {
        query += ` AND t.trip_status = $${paramIndex}`;
        values.push(trip_status);
        paramIndex++;
      }

      if (departure_date) {
        query += ` AND DATE(t.departure_time) = $${paramIndex}`;
        values.push(departure_date);
        paramIndex++;
      } else {
        query += ` AND t.departure_time > NOW()`;
      }

      // query += ` ORDER BY t.departure_time`;
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      values.push(parseInt(limit), parseInt(offset));

      const trips = await this.db.any(query, values);

      return await Promise.all(
        trips.map(async (trip) => {
          const [waypoints, totalWaypoints] = await Promise.all([
            this._getRelevantWaypoints(
              trip.trip_id,
              start_location,
              end_location,
              radius_km
            ),
            this.waypointRespository.findByTripId(trip.trip_id),
          ]);
          return {
            ...trip,
            waypoints: waypoints,
            waypoint_stats: {
              total_waypoints: totalWaypoints.length,
              relevant_waypoints: waypoints.length,
            },
          };
        })
      );
    } catch (err) {
      console.error('Error executing findAll query:', err);
      throw err;
    }
  }

  _validateCoordinates(location, locationName = 'location') {
    if (
      !location ||
      typeof location.lat === 'undefined' ||
      typeof location.lng === 'undefined'
    ) {
      throw new Error(`${locationName} is required`);
    }

    const { lat, lng } = location;

    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new Error(`Invalid coordinates in ${locationName}`);
    }
    return { lat, lng };
  }

  async _generateAndSaveTripPolyline(t, tripId) {
    const polylineUpdateQuery = `
      UPDATE trips
      SET polyline_path = ST_MakeLine(
        ARRAY [
          start_geopoint::geometry
          ] || ARRAY(
          SELECT geopoint::geometry
          FROM trip_waypoints
          WHERE trip_id = $1
          ORDER BY sequence_order
               ) || ARRAY [
          end_geopoint::geometry
          ]
                          )::geography
      WHERE trip_id = $1
      RETURNING
        ST_AsText(polyline_path) AS polyline_path,
        ST_Length(polyline_path) AS distance_meters
    `;
    try {
      return await t.one(polylineUpdateQuery, tripId);
    } catch (err) {
      throw err;
    }
  }

  async _insertTripWaypointsBatch(t, tripId, waypoints) {
    if (!waypoints || waypoints.length === 0) {
      return [];
    }

    const waypointsToBeInserted = waypoints.map((waypoint) => ({
      trip_id: tripId,
      location_name: waypoint.location_name,
      address_line1: waypoint.address_line1,
      geopoint: waypoint.geopoint,
      sequence_order: waypoint.sequence_order,
      estimated_arrival_time: waypoint.estimated_arrival_time,
    }));

    const insertWaypointQuery =
      this.pgp.helpers.insert(waypointsToBeInserted, waypointsColumnSet) +
      ` RETURNING *`;

    try {
      return await t.many(insertWaypointQuery);
    } catch (err) {
      throw err;
    }
  }

  _parsePointString(pointString) {
    // Regular expression to match POINT(lng lat) and capture the numbers
    const regex = /POINT\(\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s*\)/;
    const match = pointString.match(regex);

    if (match && match.length === 3) {
      const lng = parseFloat(match[1]);
      const lat = parseFloat(match[2]);

      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
    console.error('Failed to parse point string:', pointString);
    return null;
  }

  async _getRelevantWaypoints(tripId, startLocation, endLocation, radiusKm) {
    const { lat: startLat, lng: startLng } = this._validateCoordinates(
      startLocation,
      'start_location'
    );
    const radiusMeters = radiusKm * 1000;
    const radiusDegrees = radiusKm / 111.32; // Convert km to degrees for bounding box

    let query, values;

    if (endLocation) {
      const { lat: endLat, lng: endLng } = this._validateCoordinates(
        endLocation,
        'end_location'
      );

      query = `
        WITH relevant_waypoints AS (SELECT tw.waypoint_id,
                                           tw.location_name,
                                           tw.estimated_arrival_time,
                                           tw.sequence_order,
                                           tw.geopoint,
                                           -- Pre-calculate distances to avoid repeated ST_DWithin calls
                                           ST_DWithin(tw.geopoint::geography,
                                                      ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                                                      $4) as near_start,
                                           ST_DWithin(tw.geopoint::geography,
                                                      ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
                                                      $4) as near_end
                                    FROM trip_waypoints tw
                                    WHERE tw.trip_id = $1
                                      -- Use bounding box for faster initial filtering
                                      AND tw.geopoint && ST_Envelope(
                                      ST_Collect(
                                        ST_Expand(ST_SetSRID(ST_MakePoint($2, $3), 4326), $7),
                                        ST_Expand(ST_SetSRID(ST_MakePoint($5, $6), 4326), $7)
                                      )
                                                         )
                                      -- Then apply the actual distance filters
                                      AND (
                                      ST_DWithin(tw.geopoint::geography,
                                                 ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                                                 $4)
                                        OR ST_DWithin(tw.geopoint::geography,
                                                      ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
                                                      $4)
                                      ))
        SELECT waypoint_id,
               location_name,
               estimated_arrival_time,
               CASE
                 WHEN near_start AND near_end THEN
                   CASE
                     WHEN sequence_order < (SELECT AVG(sequence_order)
                                            FROM relevant_waypoints
                                            WHERE near_start
                                              AND near_end) THEN 'pickup'
                     ELSE 'dropoff' END
                 WHEN near_start THEN 'pickup'
                 WHEN near_end THEN 'dropoff'
                 ELSE 'intermediate'
                 END as waypoint_purpose
        FROM relevant_waypoints
        ORDER BY sequence_order
      `;

      values = [
        tripId,
        startLng,
        startLat,
        radiusMeters,
        endLng,
        endLat,
        radiusDegrees,
      ];
    } else {
      query = `
        SELECT tw.waypoint_id,
               tw.location_name,
               tw.estimated_arrival_time,
               'pickup' as waypoint_purpose
        FROM trip_waypoints tw
        WHERE tw.trip_id = $1
          -- Use bounding box for faster initial filtering
          AND tw.geopoint && ST_Envelope(
          ST_Expand(ST_SetSRID(ST_MakePoint($2, $3), 4326), $5)
                             )
          -- Then apply the actual distance filter
          AND ST_DWithin(tw.geopoint::geography,
                         ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                         $4)
        ORDER BY tw.sequence_order
      `;

      values = [tripId, startLng, startLat, radiusMeters, radiusDegrees];
    }

    return await this.db.any(query, values);
  }
}

module.exports = Trip;
