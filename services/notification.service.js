const admin = require('../config/firebaseAdmin');
const UserService = require('../services/user.service');

class NotificationService {
  constructor() {
    if (!admin.apps.length) {
      throw new Error(
        'FCM Service is initialized but Firebase SDK is not ready.'
      );
    }
  }

  async sendNotificationToUser(userId, notificationPayload, dataPayload) {
    console.log(userId, notificationPayload, dataPayload);
    if (!admin.apps.length) {
      console.error(
        'Firebase Admin SDK not initialized. Cannot send notifications.'
      );
      throw new Error(
        'Firebase Admin SDK not initialized. Cannot send notifications.'
      );
    }
    try {
      const user = await UserService.getUserById(userId);
      if (!user || !user.fcm_tokens || user.fcm_tokens.length === 0) {
        throw new Error('No FCM tokens found');
      }
      const message = {
        notification: notificationPayload,
        data: {
          ...dataPayload,
          notificationType: dataPayload.type || 'GENERIC',
        },
        tokens: user.fcm_tokens,
      };
      const response = await admin.messaging().sendEachForMulticast(message);
      if (response.failureCount > 0) {
        let tokensToRemove = [];
        response.responses.forEach((resp, index) => {
          console.error(
            `Error sending to token ${user.fcm_tokens[index]}`,
            resp.error
          );
          if (
            resp.error.code === 'messaging/registration-token-not-registered' ||
            resp.error.code === 'messaging/invalid-argument' ||
            resp.error.code === 'messaging/not-foung'
          ) {
            tokensToRemove.push(user.fcm_tokens[index]);
          }
        });
        if (tokensToRemove.length > 0) {
          await UserService.removeFcmTokens(userId, tokensToRemove);
        }
      }
      return response;
    } catch (err) {
      throw err;
    }
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
    await this.sendNotificationToUser(
      driverId,
      notificationPayload,
      dataPayload
    );
  }

  async sendBookingStatusUpdate(riderId, bookingDetails) {
    const statusText =
      bookingDetails.bookings_status === 'ACCEPTED' ? 'Accepted' : 'Rejected';
    const notificationPayload = {
      title: `Your Booking is ${statusText}`,
      body: `Your trip booking has been ${statusText} by the driver`,
    };
    const dataPayload = {
      type: 'BOOKING_STATUS_UPDATE',
      bookingId: bookingDetails.booking_id.toString(),
      tripId: bookingDetails.trip_id.toString(),
      status: bookingDetails.bookings_status,
      driverId: bookingDetails.driver_id.toString(),
    };
    await this.sendNotificationToUser(
      riderId,
      notificationPayload,
      dataPayload
    );
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
    await this.sendNotificationToUser(
      driverId,
      notificationPayload,
      dataPayload
    );
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
    await this.sendNotificationToUser(
      riderId,
      notificationPayload,
      dataPayload
    );
  }

  async sendTripFinalizedConfirmation(driverId, tripDetails) {
    const notificationPayload = {
      title: 'Trip Confirmed By Rider!',
      body: `Your Trip with ${tripDetails.riderName || 'the driver'} has been confirmed.`,
    };
    const dataPayload = {
      type: 'TRIP_FINALIZED_CONFIRMATION',
      tripId: tripDetails.trip_id,
      riderId: tripDetails.rider_id,
    };
  }

  async registerFcmToken(userId, fcmToken) {
    try {
      await UserService.addNewFcmToken(userId, fcmToken);
    } catch (err) {
      throw err;
    }
  }

  async unregisterFcmToken(userId, fcmToken) {
    try {
      await UserService.removeFcmTokens(userId, [fcmToken]);
    } catch (err) {
      throw err;
    }
  }
}

module.exports = new NotificationService();
