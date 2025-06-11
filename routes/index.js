const express = require('express');
const userRoutes = require('./userRoutes');
const vehicleRoutes = require('./vehicleRoutes');

const router = express.Router();

router.use('/user',userRoutes);
router.use('/vehicle',vehicleRoutes);

router.get('/health',(req,res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;