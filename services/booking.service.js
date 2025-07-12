const Booking = require('../models/booking.model');
const { db } = require('../config/db');
const UserService = require('./user.service');
const Trip = require('../models/trip.model');
const TripService = require('./trip.service');

class BookingService {
  static async bookTrip(bookingData) {
    try {
      const { trip_id, rider_id, booked_seats, fare_amount } = bookingData;

      return await db.tx(async (transaction) => {
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

        // check: rider balance and available seats on the trip
        const balanceResult = await UserService.getUserWalletBalance(
          transaction,
          rider_id,
          actualFareAmount
        );
        if (balanceResult.wallet <= actualFareAmount)
          throw new Error('InSufficient Balance');
        const { available_seats } = await TripService.getAvailableSeats(
          transaction,
          trip_id
        );
        if (available_seats === 0 || available_seats === null)
          throw new Error('Trip Seats are Full');

        //create: booking record
        const booking = await Booking.addBooking(transaction, {
          ...bookingData,
          booked_seats: actualBookedSeats,
          fare_amount: actualFareAmount,
        });
        if (booking.bookings_status === 'REJECTED') {
          return booking;
        }

        //update: user wallet and trip seats
        await UserService.updateUserBalance(
          transaction,
          rider_id,
          'hold_amount',
          actualFareAmount
        );
        await UserService.updateUserBalance(
          transaction,
          rider_id,
          'wallet',
          -Number(actualFareAmount)
        );

        return booking;
      });
    } catch (err) {
      throw err;
    }
  }

  static async updateBookingStatusByDriver(bookingData) {
    const { booking_id, booking_status } = bookingData;

    try {
      return await db.tx(async (transaction) => {
        const currentBookingDetails = await Booking.getBookingById(
          transaction,
          booking_id
        );
        const {
          trip_id,
          rider_id,
          fare_amount,
          booked_seats
        } = currentBookingDetails;
        const driverResponse = await Booking.updateBookingStatus(transaction, {
          booking_id: booking_id,
          trip_id: trip_id,
          rider_id: rider_id,
          statusRequestedByUser: booking_status,
          statusToExclude: ['ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED'],
        });
        if (driverResponse) {
          if (driverResponse.bookings_status === 'ACCEPTED') {
            const updateSeatsResult = await TripService.updateSeatsInTrip(
              transaction,
              trip_id,
              booked_seats
            );
            if (
              !updateSeatsResult ||
              updateSeatsResult.available_seats === undefined
            ) {
              throw new Error(
                'Trip seats became unavailable during booking. Please try again.'
              );
            }
          } else if (driverResponse.bookings_status === 'REJECTED') {
            await UserService.updateUserBalance(
              transaction,
              rider_id,
              'hold_amount',
              -Number(fare_amount)
            );
            await UserService.updateUserBalance(
              transaction,
              rider_id,
              'wallet',
              Number(fare_amount)
            );
          }
        }
        return driverResponse;
      });
    } catch (err) {
      throw err;
    }
  }

  static async updateBookingStatusByRider(bookingData) {
    const { statusRequestedByUser } = bookingData;
    try {
      return await db.tx(async (transaction) => {
        switch (statusRequestedByUser) {
          case 'CANCELLED':
            return await this._handleCancellation(transaction, bookingData);
          case 'COMPLETED':
            return await this._handleConfirmation(transaction, bookingData);
          default:
            throw new Error('Invalid status update requested!');
        }
      });
    } catch (err) {
      throw err;
    }
  }

  static async _handleCancellation(transaction, bookingData) {
    const { booking_id, driver_id } = bookingData;
    const currentBookingDetails = await Booking.getBookingById(
      transaction,
      booking_id
    );
    if (!currentBookingDetails)
      throw new Error('Unable to fetch Booking Details');

    const {
      bookings_status: currentBookingStatus,
      trip_id,
      rider_id,
      fare_amount,
      booked_seats,
    } = currentBookingDetails;

    const isBookingAlreadyCancelled =
      currentBookingStatus === 'CANCELLED' ||
      currentBookingStatus === 'REJECTED';
    if (isBookingAlreadyCancelled) {
      throw new Error('Booking is already cancelled');
    }

    const updates = [];
    const userRequestStatus = 'CANCELLED';

    if (currentBookingStatus === 'ACCEPTED') {
      updates.push(
        UserService.updateUserBalance(
          transaction,
          driver_id,
          'wallet',
          Number(fare_amount) / 2
        ),
        UserService.updateUserBalance(
          transaction,
          rider_id,
          'wallet',
          Number(fare_amount) / 2
        ),
        UserService.updateUserBalance(
          transaction,
          rider_id,
          'hold_amount',
          -Number(fare_amount)
        )
      );
    } else if (currentBookingDetails === 'PENDING') {
      updates.push(
        UserService.updateUserBalance(
          transaction,
          rider_id,
          'hold_amount',
          -Number(fare_amount)
        ),
        UserService.updateUserBalance(
          transaction,
          rider_id,
          'wallet',
          Number(fare_amount)
        )
      );
    }

    updates.push(
      Booking.updateBookingStatus(transaction, {
        ...currentBookingDetails,
        statusToExclude: ['CANCELLED', 'REJECTED'],
        statusRequestedByUser: userRequestStatus,
      }),
      Trip.updateSeatsInTrip(transaction, trip_id, -booked_seats)
    );

    await transaction.batch(updates);
    return { booking_id: booking_id };
  }

  static async _handleConfirmation(transaction, bookingData) {
    const { booking_id, driver_id } = bookingData;
    const currentBookingDetails = await Booking.getBookingById(
      transaction,
      booking_id
    );
    if (!currentBookingDetails)
      throw new Error('Unable to fetch Booking Details');
    const { rider_id, fare_amount } = currentBookingDetails;
    let updates = [];
    updates.push(
      UserService.updateUserBalance(
        transaction,
        rider_id,
        'hold_amount',
        -Number(fare_amount)
      ),
      UserService.updateUserBalance(
        transaction,
        driver_id,
        'wallet',
        Number(fare_amount)
      ),
      Booking.updateBookingStatus(transaction, {
        ...currentBookingDetails,
        statusToExclude: ['CANCELLED', 'REJECTED'],
        statusRequestedByUser: 'COMPLETED',
      })
    );
    await transaction.batch(updates);
    return {
      booking: booking_id,
    };
  }
}

module.exports = BookingService;
