const pgp = require('pg-promise')();
const {connectionString} = require('../config/db');

const db = pgp(connectionString);

module.exports = db;