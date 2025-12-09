const { Worker } = require('bullmq');
const admin = require('../config/firebaseAdmin');
const { connection } = require('../config/queue');
const Redis = require('ioredis');

const { db: dbPromise, pgp } = require('../config/db');
const UserService = require('../services/user.service');
const UserRepository = require('../models/user.model');

let publisher;
const PUSH_CHANNEL = 'notifications:new';

(async () => {
  try {
    console.log('---------------------------------------------------');
    console.log('[Worker Init] Starting Notification Worker Process...');
    console.log('[Worker Init] Redis Config:', {
      host: connection.options.host,
      port: connection.options.port,
      status: connection.status,
    });

    publisher = new Redis(connection.options);
    publisher.on('error', (err) =>
      console.error('[Publisher Error] Redis:', err)
    );

    console.log('[Worker Init] Connecting to Database...');
    const dbClient = await dbPromise;
    console.log('[Worker Init] Database Connected Successfully!');

    const userRepository = new UserRepository(dbClient, pgp);
    const userService = new UserService(userRepository);
    console.log('[Worker Init] UserService & Repository initialized.');
    console.log('---------------------------------------------------');

    const worker = new Worker(
      'notification-queue',
      async (job) => {
        const jobId = job.id;
        console.log(`\n[Job ${jobId}] STARTING PROCESSING -----------------`);

        try {
          const { userId, notificationPayload, dataPayload } = job.data;
          console.log(`[Job ${jobId}] Target User ID: ${userId}`);

          if (!admin.apps.length) {
            console.error(
              `[Job ${jobId}]  FATAL: Firebase Admin SDK not initialized.`
            );
            throw new Error('Firebase Admin SDK not initialized.');
          }

          console.log(`[Job ${jobId}] Fetching user details from DB...`);
          const user = await userService.getUserById(userId);

          if (!user) {
            console.warn(
              `[Job ${jobId}]  User not found in database. Skipping.`
            );
            return;
          }

          console.log(
            `[Job ${jobId}] User found: ${user.email} (ID: ${user.user_id})`
          );

          if (!user.fcm_tokens || user.fcm_tokens.length === 0) {
            console.warn(
              `[Job ${jobId}]  No FCM tokens found for user. Cannot send notification.`
            );
            return;
          }

          console.log(
            `[Job ${jobId}] Found ${user.fcm_tokens.length} FCM token(s). Preparing message...`
          );

          const message = {
            notification: notificationPayload,
            data: {
              ...dataPayload,
              notificationType: dataPayload.type || 'GENERIC',
            },
            tokens: user.fcm_tokens,
          };

          console.log(
            `[Job ${jobId}] 🚀 Sending to Firebase Cloud Messaging...`
          );
          const response = await admin
            .messaging()
            .sendEachForMulticast(message);

          console.log(`[Job ${jobId}]  FCM Response Received:`, {
            successCount: response.successCount,
            failureCount: response.failureCount,
          });

          if (response.failureCount > 0) {
            console.log(
              `[Job ${jobId}]  Handling ${response.failureCount} failed deliveries...`
            );

            const tokensToRemove = [];
            response.responses.forEach((resp, index) => {
              if (!resp.success) {
                const error = resp.error;
                console.error(
                  `[Job ${jobId}] Token Error [${index}]:`,
                  error.code
                );

                if (
                  error.code ===
                    'messaging/registration-token-not-registered' ||
                  error.code === 'messaging/invalid-argument' ||
                  error.code === 'messaging/not-found'
                ) {
                  tokensToRemove.push(user.fcm_tokens[index]);
                }
              }
            });

            if (tokensToRemove.length > 0) {
              console.log(
                `[Job ${jobId}] Database Update: Removing ${tokensToRemove.length} invalid tokens...`
              );
              await userService.removeFcmTokens(userId, tokensToRemove);
              console.log(`[Job ${jobId}] Tokens removed successfully.`);
            }
          }

          if (response.successCount > 0) {
            const realtimePayload = {
              userId: userId,
              ...notificationPayload,
              ...dataPayload,
              sentAt: new Date().toISOString(),
            };

            if (publisher.status !== 'ready') {
              console.error('Redis Publisher is NOT ready!');
            }

            await publisher.publish(
              PUSH_CHANNEL,
              JSON.stringify(realtimePayload)
            );
          }

          console.log(`[Job ${jobId}] FINISHED PROCESSING -----------------`);
          return response;
        } catch (err) {
          console.error(`[Job ${jobId}]  CRITICAL ERROR:`, err);
          throw err;
        }
      },
      {
        connection,
        concurrency: 5,
      }
    );

    // 6. Setup Worker Event Listeners
    worker.on('ready', () => {
      console.log('[Worker Event]  Worker is ready and waiting for jobs.');
    });

    worker.on('error', (err) => {
      console.error('[Worker Event]  Worker connection error:', err);
    });

    worker.on('failed', (job, err) => {
      console.error(
        `[Worker Event]  Job ${job.id} failed with error: ${err.message}`
      );
    });
  } catch (error) {
    console.error('FAILED TO START WORKER PROCESS:', error);
    process.exit(1);
  }
})();
