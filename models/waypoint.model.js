const {db} = require("../config/db");

class Waypoint {
    static async addToTrip(dbOrTx, tripId, waypointData) {
        try {
            const query = `
                INSERT INTO trip_waypoints (trip_id, location_name, address_line1, geopoint,
                                            sequence_order, estimated_arrival_time)
                VALUES ($1, $2, $3, ST_GeogFromText($4), $5, $6)
                RETURNING *, ST_AsText(geopoint) as geopoint_text
            `;

            return await dbOrTx.one(query, [
                tripId,
                waypointData.location_name,
                waypointData.address_line1,
                waypointData.geopoint,
                waypointData.sequence_order,
                waypointData.estimated_arrival_time
            ]);
        } catch (error) {
            throw error;
        }
    }

    static async findByTripId(tripId) {
        try {
            const query = `
                SELECT *, ST_AsText(geopoint) as geopoint_text
                FROM trip_waypoints
                WHERE trip_id = $1
                ORDER BY sequence_order ASC
            `;

            return await db.any(query, [tripId]);
        } catch (error) {
            throw error;
        }
    }

    static async update(dbOrTx, waypointId, updateData) {
        try {
            const updateFields = [];
            const params = [];
            let paramIndex = 1;

            const allowedFields = [
                'location_name', 'address_line1', 'sequence_order',
                'estimated_arrival_time', 'actual_arrival_time'
            ];

            allowedFields.forEach(field => {
                if (updateData[field] !== undefined) {
                    updateFields.push(`${field} = $${paramIndex++}`);
                    params.push(updateData[field]);
                }
            });

            // Handle geography field separately
            if (updateData.geopoint) {
                updateFields.push(`geopoint = ST_GeogFromText($${paramIndex++})`);
                params.push(updateData.geopoint);
            }

            if (updateFields.length === 0) {
                throw new Error('No valid fields to update');
            }

            updateFields.push(`updated_at = NOW()`);
            params.push(waypointId); // Add waypointId to params for the WHERE clause

            const query = `
                UPDATE trip_waypoints
                SET ${updateFields.join(', ')}
                WHERE waypoint_id = $${paramIndex}
                RETURNING *, ST_AsText(geopoint) as geopoint_text
            `;

            return await dbOrTx.oneOrNone(query, params);
        } catch (error) {
            throw error;
        }
    }

    static async delete(waypointId) {
        try {
            const query = 'DELETE FROM trip_waypoints WHERE waypoint_id = $1 RETURNING *';
            return await db.oneOrNone(query, [waypointId]);
        } catch (error) {
            console.error('Error deleting waypoint:', error);
            throw error;
        }
    }
}

module.exports = Waypoint;