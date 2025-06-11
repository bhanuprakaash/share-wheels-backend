const VehicleService = require("../services/VehicleService");
const vehicleController = {
    async getVehicleById(req, res, next) {
        try {
            const { vehicleId } = req.params;
            const vehicle = await VehicleService.getVehicleById(vehicleId);

            res.status(200).json({
                success: true,
                data: vehicle
            });
        } catch (error) {
            next(error);
        }
    },
    async getMyVehicles(req, res, next) {
        try {
            const driverId = req.user.userId;
            const vehicles = await VehicleService.getVehiclesByDriverId(driverId);

            res.status(200).json({
                success: true,
                data: vehicles
            });
        } catch (error) {
            next(error);
        }
    },
    async createVehicle(req, res, next) {
        try {
            const vehicleData = {
                ...req.body,
                driver_id: req.user.userId
            };

            const vehicle = await VehicleService.createVehicle(vehicleData);

            res.status(201).json({
                success: true,
                message: 'Vehicle created successfully',
                data: vehicle
            });
        } catch (error) {
            next(error);
        }
    },
    async updateVehicle(req, res, next) {
        try {
            const { vehicleId } = req.params;

            // First check if the vehicle belongs to the authenticated user
            const existingVehicle = await VehicleService.getVehicleById(vehicleId);
            if (existingVehicle.driver_id !== req.user.userId) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only update your own vehicles'
                });
            }

            const vehicle = await VehicleService.updateVehicle(vehicleId, req.body);

            res.status(200).json({
                success: true,
                message: 'Vehicle updated successfully',
                data: vehicle
            });
        } catch (error) {
            next(error);
        }
    },
    async deleteVehicle(req, res, next) {
        try {
            const { vehicleId } = req.params;

            // First check if the vehicle belongs to the authenticated user
            const existingVehicle = await VehicleService.getVehicleById(vehicleId);
            if (existingVehicle.driver_id !== req.user.userId) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only delete your own vehicles'
                });
            }

            await VehicleService.deleteVehicle(vehicleId);

            res.status(200).json({
                success: true,
                message: 'Vehicle deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = vehicleController;