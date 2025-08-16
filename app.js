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

// Security middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

async function startServer() {
  try {
    await db.connect();

    const { controllers } = await setupDependencies();

    const routes = require('./routes/index.routes')(controllers);

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
