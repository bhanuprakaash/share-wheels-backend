# ShareWheels Backend 

This repository hosts the backend API and background processing services for ShareWheels, a modern Node.js application. The stack utilizes PostgreSQL for relational and geospatial data, and Redis for caching and high-speed, real-time communication.

## Project Highlights

* **Geospatial Matching:** Implemented core business logic using **PostGIS** (PostgreSQL) for spatial queries, enabling complex rider-to-driver route segment matching.
* **Real-Time Architecture:** Features a robust system for instant user notifications using **BullMQ**, Redis Pub/Sub, and **Socket.IO** integration.
* **Production Security:** Hardened endpoints with **IP-based Rate Limiting** using a combined Nginx and Express middleware setup.
* **Containerized CI/CD:** Automated deployment pipeline using **GitHub Actions** to build images and perform "pull-only" deployments to a dedicated Google Cloud VM instance.

## Architecture & Data Flow

The system operates as a decoupled microservice structure orchestrated by Docker Compose, maximizing resource usage on the free-tier infrastructure. 

```text
+-------------------------------------------------------------------------------+
|  GOOGLE CLOUD PLATFORM (GCP) - VM                                             |
|                                                                               |
|   +-----------------------+                                                   |
|   |  Nginx Reverse Proxy  |  <--- (1) Inbound Traffic (HTTPS / 443)           |
|   |  (Host Level)         |                                                   |
|   +-----------+-----------+                                                   |
|               |                                                               |
|               | (Proxy Pass: localhost:3001)                                  |
|               v                                                               |
|   +-----------------------------------------------------------------------+   |
|   |  DOCKER COMPOSE NETWORK (Private Subnet / Bridge)                     |   |
|   |                                                                       |   |
|   |     +-------------+                    +-------------+                |   |
|   |     |             |   (2) Read/Write   |             |                |   |
|   |     |  API Server | -----------------> |  Postgres   |                |   |
|   |     |    (App)    |                    |  (Database) |                |   |
|   |     |             | <----------------- |             |                |   |
|   |     +-------------+                    +-------------+                |   |
|   |        |       ^                                                      |   |
|   |    (3) |       | (6) Real-time                                        |   |
|   |    Add |       |     Event                                            |   |
|   |    Job |       |                                                      |   |
|   |        v       |                                                      |   |
|   |     +-------------+                    +-------------+                |   |
|   |     |             |    (4) Process     |             |                |   |
|   |     |    Redis    | -----------------> |   Worker    |                |   |
|   |     | (Queue/Bus) |                    |   Service   |                |   |
|   |     |             | <----------------- |             |                |   |
|   |     +-------------+    (5) Publish     +-------------+                |   |
|   |                                                                       |   |
|   +-----------------------------------------------------------------------+   |
|                                                                               |
+-------------------------------------------------------------------------------+


### 1. Overall Service Topology

| Service | Technology | Primary Role |
| :--- | :--- | :--- |
| `app` (Server) | Node.js/Express, Socket.IO | Handles all inbound HTTP/HTTPS requests, API routing, and maintains persistent WebSocket connections. |
| `worker` (Processor) | Node.js/BullMQ | Processes long-running tasks, sends **FCM** push notifications, and publishes real-time events. |
| `postgres` | PostgreSQL, PostGIS | Primary database for application state and geospatial queries. |
| `redis` | Redis | High-speed cache, message broker for BullMQ (queues), and real-time Pub/Sub communication. |

### 2. The Real-Time Notification Pipeline

The system is designed to notify the client **instantly** (via Socket.IO) upon event completion (via FCM).



| Step | Component | Action |
| :--- | :--- | :--- |
| **1. Enqueue Job** | `app` (API) | Pushes job to the BullMQ queue in Redis (e.g., "send booking request"). |
| **2. Process Job** | `worker` | Executes Firebase Cloud Messaging (FCM) delivery and cleans up invalid tokens. |
| **3. Publish Event** | `worker` | Publishes a JSON payload containing the `userId` to the Redis **Pub/Sub** channel (`notifications:new`). |
| **4. Push to Client** | `app` (Server) | The dedicated Redis **Subscriber** receives the message and uses the associated Socket ID (`io.to(socketId).emit()`) to push the update directly to the correct user's browser. |

---

## 💻 Tech Stack

| Category | Technology | Purpose |
| :--- | :--- | :--- |
| **Language** | Node.js (JavaScript/TypeScript) | Server-side runtime environment. |
| **Framework** | Express.js | API routing and middleware management. |
| **Database** | PostgreSQL + PostGIS | Relational data persistence and advanced geographical queries. |
| **Queue/Real-Time** | BullMQ, Redis, Socket.IO | Asynchronous task management and persistent client communication. |
| **DevOps/Infra** | Docker, Docker Compose, GitHub Actions | Container orchestration, environment consistency, and CI/CD automation. |

---
