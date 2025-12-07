const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const errorHandler = require('./middleware/errorHandler');
const config = require('./config/env');
const db = require('./config/db');
const setupDependencies = require('./config/di.config');
const app = express();

let server;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://sharewheels.bhanuprakashsai.com',
];

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) === -1) {
        const msg =
          'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

async function startServer() {
  try {
    await db.connect();

    const { controllers, repositories } = await setupDependencies();

    const routes = require('./routes/index.routes')(controllers, repositories);

    app.use('/api', routes);

    app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found',
      });
    });
    app.use(errorHandler);

    server = app.listen(config.PORT, () => {
      console.log(`Server listening on port ${config.PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server: ', err.message);
    process.exit(1);
  }
}

startServer();

process.on('SIGINT', () => {
  console.log('Received SIGINT. Graceful shutdown...');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Graceful shutdown...');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});
module.exports = app;
