const {db} = require("../config/db");

class Vehicle {
    static async findById(vehicleId) {
        try {
            const query = `SELECT *
                           FROM vehicles
                           WHERE vehicle_id = $1`;
            return await db.oneOrNone(query, [vehicleId]);
        } catch (err) {
            throw err;
        }
    }

    static async findByDriverId(driverId) {
        try {
            const query = `SELECT *
                           FROM vehicles
                           where driver_id = $1`;
            return await db.any(query, [driverId]);
        } catch (err) {
            throw err;
        }
    }

    static async create(vehicleData) {
        try {
            return await db.one(`
                INSERT INTO vehicles (driver_id, make, model, year, license_plate, color, seating_capacity,
                                      vehicle_ai_image)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [
                vehicleData.driver_id,
                vehicleData.make,
                vehicleData.model,
                vehicleData.year,
                vehicleData.license_plate,
                vehicleData.color,
                vehicleData.seating_capacity,
                vehicleData.vehicle_ai_image
            ]);
        } catch (error) {
            throw error;
        }
    }

    static async update(vehicleId, vehicleData) {
        try {
            const fields = [];
            const values = [];
            let paramCount = 1;

            Object.entries(vehicleData).forEach(([key, value]) => {
                if (value !== undefined && key !== 'vehicle_id' && key !== 'created_at') {
                    fields.push(`${key} = $${paramCount}`);
                    values.push(value);
                    paramCount++;
                }
            });

            if (fields.length === 0) {
                throw new Error('No fields to update');
            }

            fields.push(`updated_at = NOW()`);
            values.push(vehicleId);

            return await db.oneOrNone(`
                UPDATE vehicles
                SET ${fields.join(', ')}
                WHERE vehicle_id = $${paramCount}
                RETURNING *
            `, values);
        } catch (error) {
            throw error;
        }
    }

    static async delete(vehicleId) {
        try {
            return await db.oneOrNone('DELETE FROM vehicles WHERE vehicle_id = $1 RETURNING *', [vehicleId]);
        } catch (error) {
            throw error;
        }
    }
}

module.exports = Vehicle;