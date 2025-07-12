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

        if (booking.bookings_status === 'REJECTED') {
          return booking;
        }

        //update user wallet and trip seats
        const { wallet } = await User.updateWalletAndHoldBalance(
          transaction,
          rider_id,
          -actualFareAmount,
          true,
          actualFareAmount
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
          driver_id: updateSeatsResult.driver_id,
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
        return { ...result, driver_id: driver_id };
      });
    } catch (err) {
      throw err;
    }
  }

  static async updateBookingStatusByRider(bookingData) {
    const { trip_id, booking_id, rider_id, user_request_status, driver_id } =
      bookingData;
    const query = `
      UPDATE bookings
      SET bookings_status='CANCELLED',
          updated_at=NOW()
      WHERE booking_id = $1
        AND rider_id = $2
        AND trip_id = $3
        AND bookings_status NOT IN ('CANCELLED', 'REJECTED')
        AND EXISTS(SELECT 1 FROM trips WHERE trips.trip_id = $4)
      RETURNING bookings_status
    `;
    try {
      return await db.tx(async (transaction) => {
        if (user_request_status !== 'CANCELLED')
          throw new Error("You Can't do this operation");

        const { bookings_status, fare_amount, booked_seats } =
          await this.getBookingById(transaction, booking_id);

        const bookingStatusResponse = await transaction.oneOrNone(query, [
          booking_id,
          rider_id,
          trip_id,
          trip_id,
        ]);

        if (!bookingStatusResponse)
          throw new Error("Can't able to update the status");

        let walletDeduction;
        let sendNotificationToDriver = false;
        if (bookings_status === 'ACCEPTED') {
          walletDeduction = Number(fare_amount) / 2;
          await User.updateWalletAndHoldBalance(
            transaction,
            driver_id,
            walletDeduction,
            false
          );
          sendNotificationToDriver = true;
        } else {
          walletDeduction = 0;
        }

        const { wallet } = await User.updateWalletAndHoldBalance(
          transaction,
          rider_id,
          walletDeduction,
          true,
          -walletDeduction
        );

        const updateSeatsResult = await Trip.updateSeatsInTrip(
          transaction,
          trip_id,
          -booked_seats
        );

        return {
          wallet: wallet,
          updated_seats: updateSeatsResult.available_seats,
          sendNotificationToDriver: sendNotificationToDriver,
          driver_id: driver_id,
          rider_id: rider_id,
          booking_id: booking_id,
        };
      });
    } catch (err) {
      throw err;
    }
  }

  static async getBookingById(dbInstance, booking_id) {
    try {
      const query = `
        SELECT booking_id, trip_id, rider_id, bookings_status, fare_amount, booked_seats
        FROM bookings
        WHERE booking_id = $1;
      `;
      const bookingResponse = await dbInstance.oneOrNone(query, [booking_id]);
      if (!bookingResponse) throw new Error('Booking is not Found');
      return bookingResponse;
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
