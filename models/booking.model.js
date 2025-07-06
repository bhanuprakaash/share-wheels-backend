const { db } = require('../config/db');
const User = require('../models/user.model');
const Trip = require('./trip.model');

class Booking {
  static async addBooking(bookingData) {
    const {
      trip_id,
      rider_id,
      start_geopoint,
      end_geopoint,
      booked_seats,
      fare_amount,
    } = bookingData;

    const actualFareAmount = Number(fare_amount);
    if (isNaN(actualFareAmount) || actualFareAmount < 0) {
      throw new Error(
        'Invalid fare_amount provided. Must be a non-negative number.'
      );
    }
    const actualBookedSeats = Number(booked_seats);
    if (isNaN(actualBookedSeats) || actualBookedSeats <= 0) {
      throw new Error(
        'Invalid booked_seats provided. Must be a positive number.'
      );
    }

    try {
      return await db.tx(async (transaction) => {
        // check: rider balance and available seats on the trip
        const isUserBalanceAvailable = await this._checkWalletBalance(
          transaction,
          rider_id,
          actualFareAmount
        );
        if (!isUserBalanceAvailable) throw new Error('Insufficient Balance');
        const availableSeats = await this._getAvailableSeats(
          transaction,
          trip_id
        );
        if (availableSeats === 0 || availableSeats === null)
          throw new Error('Trip Seats are Unavailable');

        //create and booking record
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
          actualBookedSeats,
          actualFareAmount,
        ]);

        //update user wallet and trip seats
        const { wallet } = await User.updateWalletBalanceAndHold(
          transaction,
          rider_id,
          -actualFareAmount,
          true
        );
        const updateSeatsResult = await Trip.updateSeatsInTrip(
          transaction,
          trip_id,
          actualBookedSeats
        );
        if (
          !updateSeatsResult ||
          updateSeatsResult.available_seats === undefined
        )
          throw new Error(
            'Trip seats became unavailable during booking. Please try again.'
          );
        return {
          ...booking,
          wallet: wallet,
          remaining_seats: updateSeatsResult.available_seats,
        };
      });
    } catch (err) {
      throw err;
    }
  }

  static async updateBookingStatusByDriver(bookingData) {
    const { booking_id, trip_id, driver_id, booking_status } = bookingData;
    try {
      return db.tx(async (transaction) => {
        const query = `
          UPDATE bookings
          SET bookings_status = $1,
              updated_at=NOW()
          WHERE booking_id = $2
            AND bookings_status = 'PENDING'
            AND trip_id = $3
            AND EXISTS (SELECT 1
                        FROM trips
                        WHERE trips.trip_id = $4
                          AND trips.driver_id = $5)
          RETURNING *
        `;
        const result = await transaction.oneOrNone(query, [
          booking_status,
          booking_id,
          trip_id,
          trip_id,
          driver_id,
        ]);
        if (!result) throw new Error('Something Went Wrong');
        return result;
      });
    } catch (err) {
      throw err;
    }
  }

  static async _checkWalletBalance(transaction, userId, fareAmount) {
    try {
      const { wallet } = await User.getWalletBalanceByUserId(
        transaction,
        userId
      );
      return wallet >= Number(fareAmount);
    } catch (err) {
      throw err;
    }
  }

  static async _getAvailableSeats(transaction, tripId) {
    try {
      const { available_seats } = await Trip.getAvailableSeatsByTripId(
        transaction,
        tripId
      );
      return available_seats;
    } catch (err) {
      throw err;
    }
  }
}

module.exports = Booking;
