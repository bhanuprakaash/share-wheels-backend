
class Vehicle {
  constructor(dbClient){
    this.db = dbClient;
  }
  async findById(vehicleId) {
    try {
      const query = `SELECT *
                           FROM vehicles
                           WHERE vehicle_id = $1`;
      return await this.db.oneOrNone(query, [vehicleId]);
    } catch (err) {
      throw err;
    }
  }

  async findByDriverId(driverId) {
    try {
      const query = `SELECT *
                           FROM vehicles
                           where driver_id = $1`;
      return await this.db.any(query, [driverId]);
    } catch (err) {
      throw err;
    }
  }

  async create(vehicleData) {
    try {
      return await this.db.one(
        `
                INSERT INTO vehicles (driver_id, make, model, year, license_plate, color, seating_capacity,
                                      vehicle_ai_image)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `,
        [
          vehicleData.driver_id,
          vehicleData.make,
          vehicleData.model,
          vehicleData.year,
          vehicleData.license_plate,
          vehicleData.color,
          vehicleData.seating_capacity,
          vehicleData.vehicle_ai_image,
        ]
      );
    } catch (error) {
      throw error;
    }
  }

  async update(vehicleId, vehicleData) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.entries(vehicleData).forEach(([key, value]) => {
        if (
          value !== undefined &&
          key !== 'vehicle_id' &&
          key !== 'created_at'
        ) {
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

      return await this.db.oneOrNone(
        `
                UPDATE vehicles
                SET ${fields.join(', ')}
                WHERE vehicle_id = $${paramCount}
                RETURNING *
            `,
        values
      );
    } catch (error) {
      throw error;
    }
  }

  async delete(vehicleId) {
    try {
      return await this.db.oneOrNone(
        'DELETE FROM vehicles WHERE vehicle_id = $1 RETURNING *',
        [vehicleId]
      );
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Vehicle;
