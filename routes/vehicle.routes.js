const express = require('express');
const vehicleController = require("../controllers/vehicle.controller");
const {authenticateToken} = require("../middleware/auth");

const router = express.Router();

router.use(authenticateToken);
router.get("/my-vehicles", vehicleController.getMyVehicles);
router.post("/", vehicleController.createVehicle);
router.get("/:vehicleId", vehicleController.getVehicleById);
router.put("/:vehicleId", vehicleController.updateVehicle);
router.delete("/:vehicleId", vehicleController.deleteVehicle);

module.exports = router;