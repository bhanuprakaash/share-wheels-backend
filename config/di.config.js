const { db, pgp } = require('./db');

//Repositories
const UserRepository = require('../models/user.model');
const VehicleRepository = require('../models/vehicle.model');
const TripRepository = require('../models/trip.model');
const WaypointRepository = require('../models/waypoint.model');
const BookingRepository = require('../models/booking.model');

//Services
const UserService = require('../services/user.service');
const VehicleService = require('../services/vehicle.service');
const TripService = require('../services/trip.service');
const BookingService = require('../services/booking.service');

//Controllers
const UserController = require('../controllers/user.controller');
const VehicleController = require('../controllers/vehicle.controller');
const TripController = require('../controllers/trip.controller');
const BookingController = require('../controllers/booking.controller');

async function setupDependencies() {

  const dbClient = await db;
  
  // Initialize Repositories
  const userRepository = new UserRepository(dbClient, pgp);
  const vehicleRepository = new VehicleRepository(dbClient);
  const waypointRepository = new WaypointRepository(dbClient);
  const tripRepository = new TripRepository(dbClient, pgp, waypointRepository);
  const bookingRepository = new BookingRepository(dbClient);

  // Initialize Services
  const userService = new UserService(userRepository);
  const vehicleService = new VehicleService(vehicleRepository);
  const tripService = new TripService(tripRepository, dbClient);
  const bookingService = new BookingService(
    bookingRepository,
    dbClient,
    userService,
    tripService
  );

  //Observers
  tripService.addObserver(bookingService);

  // Initialize Controllers
  const userController = new UserController(userService);
  const vehicleController = new VehicleController(vehicleService);
  const tripController = new TripController(tripService);
  const bookingController = new BookingController(bookingService);

  return {
    controllers: {
      userController,
      vehicleController,
      tripController,
      bookingController,
    },
    services: {
      userService,
      vehicleService,
      tripService,
      bookingService,
    },
    repositories: {
      userRepository,
      vehicleRepository,
      tripRepository,
      bookingRepository,
      waypointRepository
    },
  };
}

module.exports = setupDependencies;