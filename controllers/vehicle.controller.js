class VehicleController  {

  constructor(vehicleService){
    this.vehicleService = vehicleService;
  }

  getVehicleById = async(req, res, next) => {
    try {
      const { vehicleId } = req.params;
      const vehicle = await this.vehicleService.getVehicleById(vehicleId);

      res.status(200).json({
        success: true,
        data: vehicle,
      });
    } catch (error) {
      next(error);
    }
  }
  getMyVehicles = async (req, res, next) =>{
    try {
      const driverId = req.user.userId;
      const vehicles = await this.vehicleService.getVehiclesByDriverId(driverId);

      res.status(200).json({
        success: true,
        data: vehicles,
      });
    } catch (error) {
      next(error);
    }
  }
  createVehicle = async (req, res, next) => {
    try {
      const vehicleData = {
        ...req.body,
        driver_id: req.user.userId,
      };

      const vehicle = await this.vehicleService.createVehicle(vehicleData);

      res.status(201).json({
        success: true,
        message: 'Vehicle created successfully',
        data: vehicle,
      });
    } catch (error) {
      next(error);
    }
  }
  updateVehicle = async (req, res, next) => {
    try {
      const { vehicleId } = req.params;

      // First check if the vehicle belongs to the authenticated user
      const existingVehicle = await this.vehicleService.getVehicleById(vehicleId);
      if (existingVehicle.driver_id !== req.user.userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only update your own vehicles',
        });
      }

      const vehicle = await this.vehicleService.updateVehicle(vehicleId, req.body);

      res.status(200).json({
        success: true,
        message: 'Vehicle updated successfully',
        data: vehicle,
      });
    } catch (error) {
      next(error);
    }
  }
  deleteVehicle = async (req, res, next) => {
    try {
      const { vehicleId } = req.params;

      // First check if the vehicle belongs to the authenticated user
      const existingVehicle = await this.vehicleService.getVehicleById(vehicleId);
      if (existingVehicle.driver_id !== req.user.userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own vehicles',
        });
      }

      await this.vehicleService.deleteVehicle(vehicleId);

      res.status(200).json({
        success: true,
        message: 'Vehicle deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = VehicleController;
