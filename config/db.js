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
    }
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
        interval: 1000
    }
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
        try {
            this.db = this.pgp(this.config);
            const connection = await this.db.connect();
            console.log('Successfully connected to PSQL database');
            connection.done();
            return this.db;
        } catch (error) {
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                console.log(`Connection attempt ${this.retryCount}/${this.maxRetries} failed. Retrying in ${this.retryInterval/1000}s...`);
                await new Promise(resolve => setTimeout(resolve, this.retryInterval));
                return this.connect();
            }
            console.error('Failed to connect to database after multiple attempts:', error.message);
            throw error;
        }
    }

    async disconnect() {
        if (this.db) {
            await this.pgp.end();
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

// Export database interface
module.exports = {
    connect: () => dbConnection.connect(),
    disconnect: () => dbConnection.disconnect(),
    get db() {
        return dbConnection.getConnection();
    },
    get pgp() {
        return dbConnection.pgp;
    }
};