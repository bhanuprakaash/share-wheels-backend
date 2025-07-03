const pgp = require('pg-promise')({
  capSQL: true,
  error(err, e) {
    if (e.cn) {
      console.error('Connection Error:', err.message);
    }
    if (e.query) {
      console.error('Query Error:', err.message);
      console.error('Query:', e.query);
      if (e.params) {
        console.error('Parameters:', e.params);
      }
    }
  },
});

const config = require('./env');

// Extract database configuration into a separate constant
const DB_CONFIG = {
  connectionString: config.DB_URL,
  ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000,
  max: 30,
  idleTimeoutMillis: 60000,
  min: 4,
  retry: {
    max: 3,
    interval: 1000,
  },
};

class DatabaseConnection {
  constructor(config) {
    this.config = config;
    this.pgp = pgp;
    this.db = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryInterval = 2000;
  }

  async connect() {
    if (!this.db) {
      try {
        this.db = this.pgp(this.config);
        const connection = await this.db.connect();
        console.log('Successfully connected to PSQL database');
        connection.done();
        return this.db;
      } catch (error) {
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          console.log(
            `Connection attempt ${this.retryCount}/${this.maxRetries} failed. Retrying in ${this.retryInterval / 1000}s...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryInterval)
          );
          return this.connect();
        }
        console.error(
          'Failed to connect to database after multiple attempts:',
          error.message
        );
        throw error;
      }
    }
    return this.db;
  }

  async disconnect() {
    if (this.db) {
      await this.pgp.end();
      this.db = null;
      console.log('Database connection closed');
    }
  }

  getConnection() {
    if (!this.db) {
      throw new Error('Database connection not initialized');
    }
    return this.db;
  }
}

// Create and initialize database connection
const dbConnection = new DatabaseConnection(DB_CONFIG);

const tripColumnSet = new pgp.helpers.ColumnSet(
  [
    'driver_id',
    'vehicle_id',
    'start_location_name',
    'start_address_line1',
    {
      name: 'start_geopoint',
      mod: ':raw',
      init: (col) =>
        col.value ? `ST_GeomFromText('${col.value}', 4326)::geography` : null,
    },
    'end_location_name',
    'end_address_line1',
    {
      name: 'end_geopoint',
      mod: ':raw',
      init: (col) =>
        col.value ? `ST_GeomFromText('${col.value}', 4326)::geography` : null,
    },
    'departure_time',
    'estimated_arrival_time',
    'available_seats',
    'price_per_seat',
    { name: 'trip_status', def: 'SCHEDULED' },
    'trip_description',
    { name: 'updated_at', def: () => pgp.as.func('NOW()') },
  ],
  { table: 'trips' }
);

const waypointsColumnSet = new pgp.helpers.ColumnSet(
  [
    'trip_id',
    'location_name',
    'address_line1',
    {
      name: 'geopoint',
      mod: ':raw',
      init: (col) => {
        return pgp.as.format('ST_GeomFromText($1, 4326)::geography', [
          col.value,
        ]);
      },
    },
    'sequence_order',
    'estimated_arrival_time',
  ],
  { table: 'trip_waypoints' }
);

// Export database interface
module.exports = {
  connect: () => dbConnection.connect(),
  disconnect: () => dbConnection.disconnect(),
  get db() {
    return dbConnection.getConnection();
  },
  get pgp() {
    return dbConnection.pgp;
  },
  tripColumnSet,
  waypointsColumnSet,
};
