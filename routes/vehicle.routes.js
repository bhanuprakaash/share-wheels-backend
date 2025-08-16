const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

module.exports = ({ vehicleController }) => {
  router.use(authenticateToken);
  router.get('/my-vehicles', vehicleController.getMyVehicles);
  router.post('/', vehicleController.createVehicle);
  router.get('/:vehicleId', vehicleController.getVehicleById);
  router.patch('/:vehicleId', vehicleController.updateVehicle);
  router.delete('/:vehicleId', vehicleController.deleteVehicle);

  return router;
};
