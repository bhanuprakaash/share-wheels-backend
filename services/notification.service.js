const admin = require('../config/firebaseAdmin');
const { notificationQueue } = require('../config/queue');

class NotificationService {
  constructor() {
    if (!admin.apps.length) {
      throw new Error(
        'FCM Service is initialized but Firebase SDK is not ready.'
      );
    }
  }

  async _addToQueue(userId, notificationPayload, dataPayload) {
    await notificationQueue.add('send-notification', {
      userId,
      notificationPayload,
      dataPayload
    }, {
      removeOnComplete: true,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
  }

  async sendNewBookingRequest(driverId, bookingDetails) {
    const notificationPayload = {
      title: 'New Booking Request!',
      body: 'A rider wants to book your trip.',
    };
    const dataPayload = {
      type: 'NEW_BOOKING_REQUEST',
      bookingId: bookingDetails.booking_id.toString(),
      tripId: bookingDetails.trip_id.toString(),
      riderId: bookingDetails.rider_id.toString(),
      status: bookingDetails.bookings_status,
    };
    await this._addToQueue(driverId, notificationPayload, dataPayload);
  }

  async sendBookingStatusUpdateToRider(rider_id, bookingDetails) {
    const statusText =
      bookingDetails.bookings_status === 'ACCEPTED' ? 'Accepted' : 'Rejected';
    const notificationPayload = {
      title: `Your Booking is ${statusText}`,
      body: `Your trip booking has been ${statusText} by the driver`,
    };
    const dataPayload = {
      type: 'BOOKING_STATUS_UPDATE',
    };
    await this._addToQueue(rider_id, notificationPayload, dataPayload);
  }

  async sendRiderCancellationRequest(driverId, tripDetails) {
    const { available_seats, booking_id } = tripDetails;
    const notificationPayload = {
      title: `Hey, A Rider cancelled the booking`,
      body: `${available_seats} seats still available.`,
    };
    const dataPayload = {
      type: 'BOOKING_CANCELLATION_UPDATE',
      bookingId: booking_id,
    };
    await this._addToQueue(driverId, notificationPayload, dataPayload);
  }

  async sendTripCompletionRequest(riderId, tripDetails) {
    const notificationPayload = {
      title: 'Your Trip is Completed. Please Confirm',
      body: `Your trip with ${tripDetails.driverName || 'the driver'} has ended. Please Confirm its completion.`,
    };
    const dataPayload = {
      type: 'TRIP_COMPLETION_REQUEST',
      tripId: tripDetails.trip_id.toString(),
      driverId: tripDetails.driver_id.toString(),
    };
    await this._addToQueue(riderId, notificationPayload, dataPayload);
  }

  async sendTripFinalizedConfirmation(driverId, tripDetails) {
    const notificationPayload = {
      title: 'Trip Confirmed By Rider!',
      body: `Your Trip with ${tripDetails.riderName || 'the rider'} has been confirmed.`,
    };
    const dataPayload = {
      type: 'TRIP_FINALIZED_CONFIRMATION',
    };
    await this._addToQueue(driverId, notificationPayload, dataPayload);
  }
}

module.exports = new NotificationService();
