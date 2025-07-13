class Booking {
  constructor(dbClient){
    this.db = dbClient;
  }
  async addBooking(transaction = this.db, bookingData) {
    try {
      const {
        trip_id,
        rider_id,
        start_geopoint,
        end_geopoint,
        booked_seats,
        fare_amount,
      } = bookingData;

      const bookingQuery = `
          INSERT INTO bookings (trip_id, rider_id, start_geopoint, end_geopoint, booked_seats, fare_amount)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `;
      const booking = await transaction.one(bookingQuery, [
        trip_id,
        rider_id,
        start_geopoint,
        end_geopoint,
        booked_seats,
        fare_amount,
      ]);

      return booking;
    } catch (err) {
      throw err;
    }
  }

  async updateBookingStatus(dbInstance = this.db, bookingData) {
    const {
      trip_id,
      booking_id,
      rider_id,
      statusRequestedByUser,
      statusToExclude,
    } = bookingData;

    const query = `
        UPDATE bookings
        SET
          bookings_status=$1,
          updated_at=NOW()
        WHERE
          booking_id = $2
          AND rider_id = $3
          AND trip_id = $4
          AND bookings_status NOT IN ($5:csv)
          AND EXISTS(SELECT 1 FROM trips WHERE trips.trip_id = $4)
        RETURNING *
      `;

    const params = [
      statusRequestedByUser,
      booking_id,
      rider_id,
      trip_id,
      statusToExclude,
    ];

    try {
      return await dbInstance.oneOrNone(query, params);
    } catch (err) {
      throw err;
    }
  }

  async getBookingById(dbInstance = this.db, booking_id) {
    try {
      const query = `
        SELECT booking_id, trip_id, rider_id, bookings_status, fare_amount, booked_seats
        FROM bookings
        WHERE booking_id = $1
      `;
      const bookingResponse = await dbInstance.oneOrNone(query, [booking_id]);
      if (!bookingResponse) throw new Error('Booking is not Found');
      return bookingResponse;
    } catch (err) {
      throw err;
    }
  }

  async countBookingsForTrip(dbInstance = this.db, trip_id) {
    try {
      const query = `
        SELECT COUNT(booking_id) AS count
        FROM bookings
        WHERE trip_id = $1
      `;
      const result = await dbInstance.one(query, [trip_id]);
      return parseInt(result.count, 10);
    } catch (err) {
      throw err;
    }
  }

  async countCompletedBookingsForTrip(dbInstance = this.db, trip_id) {
    try {
      const query = `
        SELECT COUNT(booking_id) AS count
        FROM bookings
        WHERE trip_id = $1 AND bookings_status = 'COMPLETED'
      `;
      const result = await dbInstance.one(query, [trip_id]);
      return parseInt(result.count, 10);
    } catch (err) {
      throw err;
    }
  }
}

module.exports = Booking; 
