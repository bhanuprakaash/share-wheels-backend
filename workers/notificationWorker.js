const { Worker } = require('bullmq');
const admin = require('../config/firebaseAdmin');
const { connection } = require('../config/queue');

// 1. Import Config and Classes
const { db: dbPromise, pgp } = require('../config/db');
const UserService = require('../services/user.service');
const UserRepository = require('../models/user.model');

// 2. Wrap initialization in an async function (Required because DB connect is async)
(async () => {
  try {
    console.log('---------------------------------------------------');
    console.log('[Worker Init] Starting Notification Worker Process...');
    console.log('[Worker Init] Redis Config:', {
      host: connection.options.host,
      port: connection.options.port,
      status: connection.status,
    });

    // 3. Wait for Database Connection
    console.log('[Worker Init] Connecting to Database...');
    const dbClient = await dbPromise; // This resolves the Promise from db.js
    console.log('[Worker Init] Database Connected Successfully!');

    // 4. Instantiate Repository and Service
    const userRepository = new UserRepository(dbClient, pgp);
    const userService = new UserService(userRepository);
    console.log('[Worker Init] UserService & Repository initialized.');
    console.log('---------------------------------------------------');

    // 5. Define the Worker
    const worker = new Worker(
      'notification-queue',
      async (job) => {
        const jobId = job.id;
        console.log(`\n[Job ${jobId}] STARTING PROCESSING -----------------`);

        try {
          // Extract data passed from the Service
          const { userId, notificationPayload, dataPayload } = job.data;
          console.log(`[Job ${jobId}] Target User ID: ${userId}`);

          // A. Check Admin SDK
          if (!admin.apps.length) {
            console.error(
              `[Job ${jobId}]  FATAL: Firebase Admin SDK not initialized.`
            );
            throw new Error('Firebase Admin SDK not initialized.');
          }

          // B. Fetch User & Tokens using the initialized Service Instance
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

          // C. Construct Message
          const message = {
            notification: notificationPayload,
            data: {
              ...dataPayload,
              notificationType: dataPayload.type || 'GENERIC',
            },
            tokens: user.fcm_tokens,
          };

          // D. Send to Firebase
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

          // E. Handle Invalid Tokens (Cleanup)
          if (response.failureCount > 0) {
            console.log(
              `[Job ${jobId}]  Handling ${response.failureCount} failed deliveries...`
            );

            const tokensToRemove = [];
            response.responses.forEach((resp, index) => {
              if (!resp.success) {
                const error = resp.error;
                // Log the error code for debugging
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

          console.log(
            `[Job ${jobId}] FINISHED PROCESSING -----------------`
          );
          return response;
        } catch (err) {
          console.error(`[Job ${jobId}]  CRITICAL ERROR:`, err);
          throw err; // Triggers BullMQ retry mechanism
        }
      },
      {
        connection,
        concurrency: 5,
      }
    );

    // 6. Setup Worker Event Listeners
    worker.on('ready', () => {
      console.log(
        '[Worker Event]  Worker is ready and waiting for jobs.'
      );
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