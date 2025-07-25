const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

module.exports = ({tripController})=>{
    router.use(authenticateToken);
    router.post('/', tripController.createTrip);
    router.get('/:tripId', tripController.getTripById);
    router.put('/:tripId', tripController.updateTrip);
    router.patch('/:tripId/status', tripController.updateTripStatus);
    router.delete('/:tripId', tripController.deleteTrip);
    router.get('/', tripController.getAllTrips);

    return router;
};
