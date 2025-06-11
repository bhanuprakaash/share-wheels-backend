const express = require('express');
const userRoutes = require('./userRoutes');

const router = express.Router();

router.use('/user',userRoutes);

router.get('/health',(req,res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;