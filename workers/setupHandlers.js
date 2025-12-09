const { Server } = require('socket.io');
const Redis = require('ioredis');
const { allowedOrigins } = require('../config/cors');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

const PUSH_CHANNEL = 'notifications:new';

let io;

function setupRealTimeHandlers(httpServer, redisConnection) {

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
      path: '/socket.io/',
    },
  });

  const userSocketMap = new Map();


  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    let userId = null;

    const token = socket.handshake.query.token;

    if (token) {
      try {
        const decoded = jwt.verify(token, config.JWT_SECRET);
        userId = decoded.userId;
      } catch (err) {
        console.warn(
          `[Socket Auth] Invalid token provided for socket ${socket.id}. Disconnecting.`
        );
        socket.disconnect();
        return;
      }
    }

    if (userId) {
      userSocketMap.set(userId, socket.id);
      console.log(`Socket connected: ${socket.id} (User: ${userId})`);
    } else {
      console.warn(
        `Socket connected: ${socket.id} (UNAUTHENTICATED) with userId: ${userId}`
      );
    }

    socket.on('disconnect', () => {
      if (userId) {
        userSocketMap.delete(userId);
        console.log(`Socket disconnected: ${socket.id} (User: ${userId})`);
      }
    });
  });

  const subscriber = new Redis(redisConnection.options);
  subscriber.on('error', (err) =>
    console.error('[Subscriber Error] Redis:', err)
  );

  subscriber.subscribe(PUSH_CHANNEL, (err, count) => {
    if (err) {
      console.error('Failed to subscribe to Redis channel:', err);
      return;
    }
    console.log(`[Pub/Sub] Successfully subscribed to ${count} channel(s).`);
  });

  subscriber.on('message', (channel, message) => {
    console.log(`[Pub/Sub DEBUG] RECEIVED MESSAGE from ${channel}: ${message}`);
    if (channel !== PUSH_CHANNEL) return;
    try {
      const payload = JSON.parse(message);
      const targetUserId = payload.userId;
      const targetSocketId = userSocketMap.get(targetUserId);

      if (targetSocketId) {
        io.to(targetSocketId).emit('notification:new', payload);
        console.log(
          `[Pub/Sub Push] Pushed notification to user ${targetUserId}`
        );
      }
    } catch (e) {
      console.error('Error processing Redis message:', e);
    }
  });

  console.log('[RealTime] Socket.IO and Redis Pub/Sub handlers initialized.');
}

module.exports = { setupRealTimeHandlers };
