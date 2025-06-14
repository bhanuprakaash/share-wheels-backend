const Vehicle = require("../models/vehicle.model");

class VehicleService {
    static async getVehicleById(vehicleId) {
        try {
            const vehicle = await Vehicle.findById(vehicleId);
            if (!vehicle) {
                throw new Error('Vehicle not found');
            }
            return vehicle;
        } catch (error) {
            throw error;
        }
    }

    static async getVehiclesByDriverId(driverId) {
        try {
            return await Vehicle.findByDriverId(driverId);
        } catch (error) {
            throw new Error(`Failed to get vehicles for driver: ${error.message}`);
        }
    }

    static async createVehicle(vehicleData) {
        try {
            // Validate required fields
            const requiredFields = ['driver_id', 'make', 'model', 'year', 'license_plate', 'seating_capacity'];
            for (const field of requiredFields) {
                if (!vehicleData[field]) {
                    throw new Error(`${field} is required`);
                }
            }

            // Validate year
            const currentYear = new Date().getFullYear();
            if (vehicleData.year < 1900 || vehicleData.year > currentYear + 1) {
                throw new Error('Invalid year');
            }

            // Validate seating capacity
            if (vehicleData.seating_capacity < 1) {
                throw new Error('Seating capacity must be greater than 0');
            }
            //
            // // Check if license plate already exists
            // const existingVehicle = await Vehicle.findByLicensePlate(vehicleData.license_plate);
            // if (existingVehicle) {
            //     throw new Error('License plate already exists');
            // }

            return await Vehicle.create(vehicleData);
        } catch (error) {
            throw error;
        }
    }

    static async updateVehicle(vehicleId, vehicleData) {
        try {
            // Check if vehicle exists
            const existingVehicle = await Vehicle.findById(vehicleId);
            if (!existingVehicle) {
                throw new Error('Vehicle not found');
            }

            // If license plate is being updated, check if it already exists
            // if (vehicleData.license_plate && vehicleData.license_plate !== existingVehicle.license_plate) {
            //     const plateExists = await Vehicle.findByLicensePlate(vehicleData.license_plate);
            //     if (plateExists) {
            //         throw new Error('License plate already exists');
            //     }
            // }

            // Validate year if provided
            if (vehicleData.year) {
                const currentYear = new Date().getFullYear();
                if (vehicleData.year < 1900 || vehicleData.year > currentYear + 1) {
                    throw new Error('Invalid year');
                }
            }

            // Validate seating capacity if provided
            if (vehicleData.seating_capacity && vehicleData.seating_capacity < 1) {
                throw new Error('Seating capacity must be greater than 0');
            }

            return await Vehicle.update(vehicleId, vehicleData);
        } catch (error) {
            throw error;
        }
    }

    static async deleteVehicle(vehicleId) {
        try {
            const deletedVehicle = await Vehicle.delete(vehicleId);
            if (!deletedVehicle) {
                throw new Error('Vehicle not found');
            }
            return deletedVehicle;
        } catch (error) {
            throw error;
        }
    }

}

module.exports = VehicleService;