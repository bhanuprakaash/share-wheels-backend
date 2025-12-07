const authorizeDriver = (bookingRepository, tripRepository) => async (req, res, next) => {
    try {
        const { booking_id } = req.params;
        const userId = req.user.userId;

        const booking = await bookingRepository.getBookingById(undefined, booking_id);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        const trip = await tripRepository.findById(booking.trip_id);
        if (!trip) {
            return res.status(404).json({ success: false, message: 'Trip not found' });
        }

        if (trip.driver_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only the driver can perform this action.',
            });
        }

        next();
    } catch (error) {
        console.error('Authorization error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const authorizeRider = (bookingRepository) => async (req, res, next) => {
    try {
        const { booking_id } = req.params;
        const userId = req.user.userId;

        const booking = await bookingRepository.getBookingById(undefined, booking_id);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        if (booking.rider_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only the rider can perform this action.',
            });
        }

        next();
    } catch (error) {
        console.error('Authorization error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = { authorizeDriver, authorizeRider };
