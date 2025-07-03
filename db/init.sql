\c share_wheels;

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';

--enum types

CREATE TYPE public.communication_enum AS ENUM (
    'CHATTY',
    'QUIET'
    );

CREATE TYPE public.gender_enum AS ENUM (
    'MALE',
    'FEMALE'
    );

CREATE TYPE public.trip_status_enum AS ENUM (
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
    );

--tables

CREATE TABLE public.users
(
    user_id         uuid                     DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    email           text UNIQUE                                                    NOT NULL,
    phone_number    text UNIQUE                                                    NOT NULL,
    password        text                                                           NOT NULL,
    first_name      text                                                           NOT NULL,
    profile_picture text,
    date_of_birth   date,
    gender          public.gender_enum,
    bio             text,
    is_active       boolean                  DEFAULT true                          NOT NULL,
    created_at      timestamp with time zone DEFAULT now()                         NOT NULL,
    updated_at      timestamp with time zone DEFAULT now()                         NOT NULL,
    last_login_at   timestamp with time zone,
    last_name       text
);

CREATE TABLE public.user_preferences
(
    user_id                  uuid PRIMARY KEY                        NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,
    allow_smoking            boolean                   DEFAULT false,
    music_genre              text[],
    has_pets                 boolean                   DEFAULT false,
    is_pet_friendly          boolean                   DEFAULT false,
    communication_preference public.communication_enum DEFAULT 'QUIET'::public.communication_enum,
    seat_preference          text,
    updated_at               timestamp with time zone  DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicles
(
    vehicle_id       uuid PRIMARY KEY         DEFAULT gen_random_uuid() NOT NULL,
    driver_id        uuid                                               NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,
    make             text                                               NOT NULL,
    model            text                                               NOT NULL,
    year             integer                                            NOT NULL,
    license_plate    text UNIQUE                                        NOT NULL,
    color            text,
    vehicle_ai_image text,
    seating_capacity integer                                            NOT NULL,
    is_verified      boolean                  DEFAULT false             NOT NULL,
    created_at       timestamp with time zone DEFAULT now()             NOT NULL,
    updated_at       timestamp with time zone DEFAULT now()             NOT NULL,
    CONSTRAINT vehicles_seating_capacity_check CHECK ((seating_capacity > 0))
);

CREATE TABLE public.trips
(
    trip_id                uuid                     DEFAULT gen_random_uuid() PRIMARY KEY        NOT NULL,
    driver_id              uuid                                                                  NOT NULL REFERENCES public.users (user_id) ON DELETE RESTRICT,
    vehicle_id             uuid                                                                  NOT NULL REFERENCES public.vehicles (vehicle_id) ON DELETE RESTRICT,
    start_location_name    text                                                                  NOT NULL,
    start_address_line1    text                                                                  NOT NULL,
    start_geopoint         public.geography(Point, 4326)                                         NOT NULL,
    end_location_name      text                                                                  NOT NULL,
    end_address_line1      text                                                                  NOT NULL,
    end_geopoint           public.geography(Point, 4326)                                         NOT NULL,
    departure_time         timestamp with time zone                                              NOT NULL,
    estimated_arrival_time timestamp with time zone,
    available_seats        integer                                                               NOT NULL,
    price_per_seat         numeric(10, 2)                                                        NOT NULL,
    trip_status            public.trip_status_enum  DEFAULT 'SCHEDULED'::public.trip_status_enum NOT NULL,
    trip_description       text,
    actual_start_time      timestamp with time zone,
    actual_end_time        timestamp with time zone,
    created_at             timestamp with time zone DEFAULT now()                                NOT NULL,
    updated_at             timestamp with time zone DEFAULT now()                                NOT NULL,
    polyline_path          public.geography(LineString, 4326),
    CONSTRAINT trips_available_seats_check CHECK ((available_seats >= 0)),
    CONSTRAINT trips_price_per_seat_check CHECK ((price_per_seat >= (0)::numeric))
);

CREATE TABLE public.trip_waypoints
(
    waypoint_id            uuid                     DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    trip_id                uuid                                               NOT NULL REFERENCES public.trips (trip_id) ON DELETE CASCADE,
    location_name          text                                               NOT NULL,
    address_line1          text                                               NOT NULL,
    geopoint               public.geography(Point, 4326)                      NOT NULL,
    sequence_order         integer                                            NOT NULL,
    estimated_arrival_time timestamp with time zone,
    actual_arrival_time    timestamp with time zone,
    created_at             timestamp with time zone DEFAULT now()             NOT NULL,
    updated_at             timestamp with time zone DEFAULT now()             NOT NULL,
    CONSTRAINT trip_waypoints_sequence_order_check CHECK ((sequence_order > 0)),
    CONSTRAINT trip_waypoints_trip_id_sequence_order_key UNIQUE (trip_id, sequence_order)
);

--indexes

--user indexes
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE INDEX idx_users_phone ON public.users USING btree (phone_number);

--vehicle indexes
CREATE INDEX idx_vehicles_driver_id ON public.vehicles USING btree (driver_id);

--trips indexes
CREATE INDEX idx_trips_departure ON public.trips USING btree (departure_time) WHERE (polyline_path IS NOT NULL);
CREATE INDEX idx_trips_driver_id ON public.trips USING btree (driver_id);
CREATE INDEX idx_trips_polyline_gist ON public.trips USING gist (polyline_path);

--trip-waypoints indexes
CREATE INDEX idx_trip_waypoints_location_gist ON public.trip_waypoints USING gist (geopoint);
CREATE INDEX idx_trip_waypoints_trip_order ON public.trip_waypoints USING btree (trip_id, sequence_order);