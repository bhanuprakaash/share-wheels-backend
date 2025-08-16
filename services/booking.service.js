class BookingService {
  constructor(bookingRepository, dbClient, userService, tripService) {
    this.bookingRepository = bookingRepository;
    this.dbClient = dbClient;
    this.userService = userService;
    this.tripService = tripService;
  }

  async bookTrip(bookingData) {
    try {
      const { trip_id, rider_id, booked_seats, fare_amount } = bookingData;

      return await this.dbClient.tx(async (transaction) => {
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
        const balanceResult = await this.userService.getUserWalletBalance(
          transaction,
          rider_id,
          actualFareAmount
        );
        if (balanceResult.wallet <= actualFareAmount)
          throw new Error('InSufficient Balance');
        const { available_seats } = await this.tripService.getAvailableSeats(
          transaction,
          trip_id
        );
        if (available_seats === 0 || available_seats === null)
          throw new Error('Trip Seats are Full');

        //create: booking record
        const booking = await this.bookingRepository.addBooking(transaction, {
          ...bookingData,
          booked_seats: actualBookedSeats,
          fare_amount: actualFareAmount,
        });
        if (booking.bookings_status === 'REJECTED') {
          return booking;
        }

        //update: user wallet and trip seats
        await this.userService.updateUserBalance(
          transaction,
          rider_id,
          'hold_amount',
          actualFareAmount
        );
        await this.userService.updateUserBalance(
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

  async updateBookingStatusByDriver(bookingData) {
    const { booking_id, booking_status } = bookingData;

    try {
      return await this.dbClient.tx(async (transaction) => {
        const currentBookingDetails =
          await this.bookingRepository.getBookingById(transaction, booking_id);
        const { trip_id, rider_id, fare_amount, booked_seats } =
          currentBookingDetails;
        const driverResponse = await this.bookingRepository.updateBookingStatus(
          transaction,
          {
            booking_id: booking_id,
            trip_id: trip_id,
            rider_id: rider_id,
            statusRequestedByUser: booking_status,
            statusToExclude: ['ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED'],
          }
        );
        if (driverResponse) {
          if (driverResponse.bookings_status === 'ACCEPTED') {
            const updateSeatsResult = await this.tripService.updateSeatsInTrip(
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
            await this.userService.updateUserBalance(
              transaction,
              rider_id,
              'hold_amount',
              -Number(fare_amount)
            );
            await this.userService.updateUserBalance(
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

  async updateBookingStatusByRider(bookingData) {
    const { statusRequestedByUser } = bookingData;
    try {
      return await this.dbClient.tx(async (transaction) => {
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

  async checkAndMarkTripAsCompleted(transaction, trip_id) {
    const total_bookings = await this.bookingRepository.countBookingsForTrip(
      transaction,
      trip_id
    );

    const completed_bookings =
      await this.bookingRepository.countCompletedBookingsForTrip(
        transaction,
        trip_id
      );

    if (total_bookings === completed_bookings) {
      await this.tripService.updateTripStatus(
        trip_id,
        'COMPLETED',
        transaction
      );
      return true;
    } else {
      return false;
    }
  }

  async onTripCancelled({ tripId, transaction }) {
    if (!transaction) {
      throw new Error('Transaction is required for booking cancellation');
    }
    try {
      const activeBookings =
        await this.bookingRepository.getActiveBookingsByTripId(
          transaction,
          tripId
        );
      for (const booking of activeBookings) {
        await this.bookingRepository.updateBookingStatus(transaction, {
          trip_id: booking.trip_id,
          rider_id: booking.rider_id,
          booking_id: booking.booking_id,
          statusToExclude: ['CANCELLED', 'REJECTED'],
          statusRequestedByUser: 'CANCELLED',
        });
        await this.userService.updateUserBalance(
          transaction,
          booking.rider_id,
          'wallet',
          Number(booking.fare_amount)
        );
        await this.userService.updateUserBalance(
          transaction,
          booking.rider_id,
          'hold_amount',
          -Number(booking.fare_amount)
        );
      }
    } catch (err) {
      throw err;
    }
  }

  async _handleCancellation(transaction, bookingData) {
    const { booking_id, driver_id } = bookingData;
    const currentBookingDetails = await this.bookingRepository.getBookingById(
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
        this.userService.updateUserBalance(
          transaction,
          driver_id,
          'wallet',
          Number(fare_amount) / 2
        ),
        this.userService.updateUserBalance(
          transaction,
          rider_id,
          'wallet',
          Number(fare_amount) / 2
        ),
        this.userService.updateUserBalance(
          transaction,
          rider_id,
          'hold_amount',
          -Number(fare_amount)
        )
      );
    } else if (currentBookingDetails === 'PENDING') {
      updates.push(
        this.userService.updateUserBalance(
          transaction,
          rider_id,
          'hold_amount',
          -Number(fare_amount)
        ),
        this.userService.updateUserBalance(
          transaction,
          rider_id,
          'wallet',
          Number(fare_amount)
        )
      );
    }

    updates.push(
      this.bookingRepository.updateBookingStatus(transaction, {
        ...currentBookingDetails,
        statusToExclude: ['CANCELLED', 'REJECTED'],
        statusRequestedByUser: userRequestStatus,
      }),
      this.tripService.updateSeatsInTrip(transaction, trip_id, -booked_seats)
    );

    await transaction.batch(updates);
    return { booking_id: booking_id };
  }

  async _handleConfirmation(transaction, bookingData) {
    const { booking_id, driver_id } = bookingData;
    const currentBookingDetails = await this.bookingRepository.getBookingById(
      transaction,
      booking_id
    );
    if (!currentBookingDetails)
      throw new Error('Unable to fetch Booking Details');
    const { rider_id, fare_amount } = currentBookingDetails;
    let updates = [];
    updates.push(
      this.userService.updateUserBalance(
        transaction,
        rider_id,
        'hold_amount',
        -Number(fare_amount)
      ),
      this.userService.updateUserBalance(
        transaction,
        driver_id,
        'wallet',
        Number(fare_amount)
      ),
      this.bookingRepository.updateBookingStatus(transaction, {
        ...currentBookingDetails,
        statusToExclude: ['CANCELLED', 'REJECTED'],
        statusRequestedByUser: 'COMPLETED',
      }),
      this.checkAndMarkTripAsCompleted(
        transaction,
        currentBookingDetails.trip_id
      )
    );
    await transaction.batch(updates);
    return {
      booking: booking_id,
    };
  }
}

module.exports = BookingService;
