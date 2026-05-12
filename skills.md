# MBRAT Rashaidah Backend Intelligence (SKILLS.md)

This document provides a deep, AI-readable analysis of the MBRAT Rashaidah backend architecture. It serves as a source of truth for understanding the system's capabilities, APIs, business logic, and infrastructure.

---

## 1. Project Overview

- **Backend Purpose**: A robust philanthropic platform for managing donations, projects, campaigns, and donors for the MBRAT Rashaidah organization.
- **Architecture Style**: Modular Monolith using NestJS (Express platform).
- **Framework**: NestJS 10.x.
- **ORM/Database**: TypeORM with MySQL/MariaDB.
- **Validation Strategy**: Class-validator with `ValidationPipe` (transform enabled, whitelist enabled).
- **Auth Strategy**: JWT-based (Access + Refresh tokens) with Passport.js.
- **Pagination Strategy**: Unified offset-based pagination with customizable limit, sorting, and search.
- **Response Conventions**: All collection responses are wrapped in a standardized DTO containing data and metadata.

---

## 2. Global Backend Architecture

### NestJS Request Lifecycle

1.  **Incoming Request** -> Middleware (Helmet, Compression, Static Assets).
2.  **Global Pipes** -> `ValidationPipe` (DTO transformation and validation).
3.  **Guards** -> `JwtAuthGuard` (Authentication) -> `RolesGuard` (Authorization).
4.  **Interceptors** -> `TrafficInterceptor` (Logging/Metrics).
5.  **Controller Handler** -> Service -> TypeORM Repository -> Database.
6.  **Response Interceptors** -> Formats the final payload.

### Key Infrastructure Components

- **AppConfigModule**: Centralized configuration using `dotenv`.
- **CommonPipesModule**: Custom pipes (e.g., UUID validation, entity existence checks).
- **PaginationModule**: Global pagination logic.
- **OutboxModule**: Event-driven architecture for reliable processing (e.g., payment success hooks).
- **TrafficInterceptor**: Global interceptor for monitoring and logging API traffic.

---

## 3. Authentication & Authorization

### JWT Flow

- **Login**: `/api/auth/login` returns `accessToken` and `refreshToken`.
- **Refresh**: `/api/auth/refresh` uses a valid `refreshToken` to issue a new `accessToken`.
- **Verification**: Email-based OTP verification via `/api/auth/otp-verify`.

### Guards & Roles

- **JwtAuthGuard**: Validates the Bearer token in the Authorization header.
- **RolesGuard**: Checks the `role` field in the JWT payload against required roles.
- **Available Roles**: `USER`, `ADMIN`, `SUPER_ADMIN`.
- **Public Access**: Marked with the `@Public()` decorator.

### Protected Routes Example

```typescript
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
```

---

## 4. Pagination Architecture

The system uses a unified pagination pattern implemented in `PaginationService`.

### Query Parameters (`PaginationQueryDto`)

| Parameter   | Type   | Default     | Max | Description                     |
| ----------- | ------ | ----------- | --- | ------------------------------- |
| `page`      | number | 1           | -   | Page number                     |
| `limit`     | number | 10          | 50  | Items per page                  |
| `offset`    | number | -           | -   | Skip N items (overrides `page`) |
| `sortBy`    | string | `createdAt` | -   | Database column to sort by      |
| `sortOrder` | enum   | `DESC`      | -   | `ASC` or `DESC`                 |
| `search`    | string | -           | -   | Fuzzy search term               |

### Unified Response Format (`CollectionResponseDto`)

```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 10,
    "offset": 0,
    "total": 100,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

## 5. Controller-by-Controller Analysis

### **ProjectsController** (`/api/projects`)

- **Purpose**: Manages philanthropic projects.
- **Entities**: `Project`, `Category`, `Country`, `Continent`, `Media`.

| Method   | Route           | Auth   | Summary                    |
| -------- | --------------- | ------ | -------------------------- |
| `GET`    | `/`             | Public | List projects with filters |
| `GET`    | `/:id`          | Public | Detailed project view      |
| `POST`   | `/`             | Admin  | Create new project         |
| `PATCH`  | `/:id`          | Admin  | Update project             |
| `DELETE` | `/:id`          | Admin  | Delete project             |
| `PATCH`  | `/:id/pin`      | Admin  | Toggle project pin state   |
| `PATCH`  | `/pins/reorder` | Admin  | Reorder pinned projects    |

---

### **DonationsController** (`/api/donations`)

- **Purpose**: Handles donation creation, status reconciliation, and payment provider webhooks.
- **Integration**: MyFatoorah V2 Gateway.

| Method | Route                       | Auth   | Summary                                     |
| ------ | --------------------------- | ------ | ------------------------------------------- |
| `POST` | `/`                         | Public | Initiate donation                           |
| `POST` | `/payment/webhook`          | Public | MyFatoorah Webhook ingestion                |
| `GET`  | `/payment-status`           | Public | Manual reconciliation (InvoiceId/PaymentId) |
| `POST` | `/payment/recover-webhooks` | Admin  | Batch recovery from MF logs                 |
| `GET`  | `/stats/summary`            | Admin  | Donation analytics                          |

---

### **AuthController** (`/api/auth`)

- **Purpose**: User registration, login, and profile management.

| Method | Route         | Auth          | Summary                     |
| ------ | ------------- | ------------- | --------------------------- |
| `POST` | `/register`   | Public        | New user registration       |
| `POST` | `/login`      | Public        | Authenticate and get tokens |
| `POST` | `/otp-verify` | Public        | Verify account via OTP      |
| `POST` | `/refresh`    | Refresh Guard | Rotate tokens               |
| `GET`  | `/profile`    | JWT Guard     | Get current user info       |

---

### **AdminController** (`/api/admin`)

- **Purpose**: System-wide administrative operations.

| Method   | Route             | Auth        | Summary                   |
| -------- | ----------------- | ----------- | ------------------------- |
| `GET`    | `/users`          | Admin       | List all registered users |
| `POST`   | `/users/:id/role` | Super Admin | Change user role          |
| `DELETE` | `/users/:id`      | Super Admin | Remove user from system   |

---

### **MediaController** (`/api/media`)

- **Purpose**: File management and uploads.
- **Storage**: Local filesystem (`/uploads`).

| Method | Route           | Auth   | Summary                           |
| ------ | --------------- | ------ | --------------------------------- |
| `POST` | `/upload`       | Admin  | Multipart file upload             |
| `GET`  | `/:id/data`     | Public | Stream file data                  |
| `POST` | `/fix-encoding` | Admin  | Correct Arabic file name encoding |

---

## 6. Entity & Database Documentation

### **Project Entity**

| Field           | Type          | Description                        |
| --------------- | ------------- | ---------------------------------- |
| `id`            | UUID          | Primary key                        |
| `title`         | Text          | Project name                       |
| `slug`          | String        | Unique SEO identifier              |
| `targetAmount`  | Decimal(15,3) | Goal amount                        |
| `currentAmount` | Decimal(15,3) | Raised amount                      |
| `status`        | Enum          | DRAFT, ACTIVE, COMPLETED, ARCHIVED |
| `isPinned`      | Boolean       | Featured on homepage               |

### **Donation Entity**

| Field            | Type          | Description                     |
| ---------------- | ------------- | ------------------------------- |
| `id`             | UUID          | Primary key                     |
| `amount`         | Decimal(15,3) | Donated amount                  |
| `status`         | Enum          | PENDING, PAID, FAILED, REFUNDED |
| `paymentId`      | UUID          | FK to Payment entity            |
| `idempotencyKey` | String        | Prevents duplicate processing   |

---

## 7. Business Flow: Payment Lifecycle

1.  **Client Calls** `POST /api/donations` with `projectId` and `amount`.
2.  **Server Creates** `Donation` (Pending) and `Payment` records.
3.  **Server Calls** MyFatoorah `ExecutePayment` and returns `paymentUrl` to Client.
4.  **Client Pays** on gateway and is redirected back.
5.  **Gateway Calls** `POST /api/donations/payment/webhook`.
6.  **Server Updates** `Donation` to `PAID`, triggers `OutboxEvent`.
7.  **OutboxProcessor** Updates `Project.currentAmount` and `Project.donationCount`.

---

## 8. Performance & Scalability Analysis

- **Query Performance**: Eager loading used for common relations (`Category`, `Country`).
- **Indexing**: Critical indexes on `status`, `paymentId`, `slug`, and FKs.
- **N+1 Risks**: Handled by TypeORM relations and `PaginationService` count queries.
- **Scalability**: Stateless JWT auth allows horizontal scaling.

---

## 9. Refactor Recommendations

1.  **Caching**: Implement Redis for frequent public queries (`/projects`, `/banners`).
2.  **Outbox Service**: Move outbox processing to a background worker (e.g., BullMQ) for higher reliability.
3.  **Media Storage**: Transition from local filesystem to S3/Cloud Storage for better scalability.
4.  **Swagger Enhancement**: Ensure all DTOs have full property descriptions and examples for better AI integration.

---

## 10. Complete Route Reference (All Endpoints)

### 10.1 Authentication Module (`/api/auth`)

| #   | Method | Route              | Auth          | Description                               |
| --- | ------ | ------------------ | ------------- | ----------------------------------------- |
| 1   | `POST` | `/auth/register`   | Public        | Register new user with email/password     |
| 2   | `POST` | `/auth/login`      | Public        | Login with email/password, returns tokens |
| 3   | `POST` | `/auth/otp-verify` | Public        | Verify OTP for registration/login         |
| 4   | `POST` | `/auth/refresh`    | Refresh Token | Refresh access token using refresh token  |
| 5   | `GET`  | `/auth/profile`    | JWT           | Get current authenticated user profile    |

**Request/Response Details:**

- **POST /auth/register**:

  - Body: `{ "email": string, "password": string }`
  - Response: `{ "status": "OTP_SENT" | "OTP_RESENT" }` or `{ "access_token", "refresh_token" }`

- **POST /auth/login**:

  - Body: `{ "email": string, "password": string }`
  - Response: `{ "status": "OTP_REQUIRED" }` or `{ "access_token", "refresh_token" }`

- **POST /auth/otp-verify**:

  - Body: `{ "email": string, "otp": string }`
  - Response: `{ "access_token", "refresh_token" }`

- **POST /auth/refresh**:

  - Headers: `Authorization: Bearer <refresh_token>`
  - Response: `{ "access_token", "refresh_token" }`

- **GET /auth/profile**:
  - Headers: `Authorization: Bearer <access_token>`
  - Response: `{ "sub", "email", "role" }`

---

### 10.2 User Module (`/api/users`)

| #   | Method   | Route        | Auth | Roles                         | Description                    |
| --- | -------- | ------------ | ---- | ----------------------------- | ------------------------------ |
| 1   | `GET`    | `/users`     | JWT  | SUPER_ADMIN, ADMIN            | List all users with pagination |
| 2   | `POST`   | `/users`     | JWT  | SUPER_ADMIN, ADMIN            | Create new user                |
| 3   | `GET`    | `/users/:id` | JWT  | SUPER_ADMIN, ADMIN, VOLUNTEER | Get user by ID                 |
| 4   | `PATCH`  | `/users/:id` | JWT  | SUPER_ADMIN, ADMIN            | Update user                    |
| 5   | `DELETE` | `/users/:id` | JWT  | SUPER_ADMIN                   | Delete user                    |

**Query Parameters (GET /users):**

- `page`: number (default: 1)
- `limit`: number (default: 10, max: 100)
- `offset`: number
- `sortBy`: string (default: createdAt)
- `sortOrder`: ASC | DESC
- `search`: string

**Response:**

```json
{
  "data": [{ "id", "email", "username", "fullName", "role", "isVerified" }],
  "meta": { "page", "limit", "offset", "total", "totalPages", "hasNextPage", "hasPrevPage" }
}
```

---

### 10.3 Admin Module (`/api/admin`)

| #   | Method   | Route                   | Auth | Roles              | Description                 |
| --- | -------- | ----------------------- | ---- | ------------------ | --------------------------- |
| 1   | `GET`    | `/admin/users`          | JWT  | SUPER_ADMIN, ADMIN | List all users (admin view) |
| 2   | `GET`    | `/admin/users/:id`      | JWT  | SUPER_ADMIN, ADMIN | Get user by ID              |
| 3   | `POST`   | `/admin/users/:id/role` | JWT  | SUPER_ADMIN        | Update user role            |
| 4   | `DELETE` | `/admin/users/:id`      | JWT  | SUPER_ADMIN        | Delete user                 |

**Request Body - POST /admin/users/:id/role:**

```json
{ "role": "super_admin" | "admin" | "volunteer" | "donor" | "user" }
```

---

### 10.4 Projects Module (`/api/projects`)

| #   | Method   | Route                            | Auth        | Description                       |
| --- | -------- | -------------------------------- | ----------- | --------------------------------- |
| 1   | `GET`    | `/projects`                      | Public      | List all projects with pagination |
| 2   | `GET`    | `/projects/stats/summary`        | JWT (ADMIN) | Get project statistics            |
| 3   | `PATCH`  | `/projects/pins/reorder`         | JWT (ADMIN) | Reorder pinned projects           |
| 4   | `GET`    | `/projects/category/:categoryId` | Public      | Find projects by category         |
| 5   | `GET`    | `/projects/country/:countryId`   | Public      | Find projects by country          |
| 6   | `GET`    | `/projects/status/:status`       | Public      | Find projects by status           |
| 7   | `POST`   | `/projects`                      | JWT (ADMIN) | Create new project                |
| 8   | `PATCH`  | `/projects/:id/pin`              | JWT (ADMIN) | Toggle project pin state          |
| 9   | `PATCH`  | `/projects/:id`                  | JWT (ADMIN) | Update project                    |
| 10  | `DELETE` | `/projects/:id`                  | JWT (ADMIN) | Delete project                    |
| 11  | `GET`    | `/projects/:id`                  | Public      | Get project by ID with details    |
| 12  | `POST`   | `/projects/:id/view`             | Public      | Increment project view count      |

**Query Parameters (GET /projects):**

- `page`, `limit`, `offset`, `sortBy`, `sortOrder`, `search`

**Path Parameters:**

- `categoryId`: UUID
- `countryId`: UUID
- `status`: draft | active | funded | closed | completed | cancelled

**Request Body - POST /projects:**

```json
{
  "title": "Project Title",
  "slug": "project-slug",
  "description": "Project description",
  "location": "Location",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "targetAmount": 10000.0,
  "categoryId": "uuid",
  "countryId": "uuid",
  "continentId": "uuid",
  "mediaIds": ["uuid1", "uuid2"],
  "isPinned": false,
  "isActive": true,
  "isDonationActive": true,
  "isProgressActive": true,
  "isTargetAmountActive": true,
  "donationGoal": 5000.0
}
```

**Response - GET /projects/:id:**

```json
{
  "id": "uuid",
  "title": "Project Title",
  "slug": "project-slug",
  "description": "...",
  "location": "...",
  "targetAmount": 10000,
  "currentAmount": 5000,
  "donationCount": 50,
  "viewCount": 100,
  "status": "active",
  "isPinned": false,
  "category": { "id", "name", "slug" },
  "country": { "id", "name", "code" },
  "continent": { "id", "name" },
  "media": [{ "id", "path", "mimeType" }],
  "donations": [...]
}
```

**POST /projects/:id/view** - Increment View Count:

- **Purpose**: Track project views for analytics and popularity ranking
- **Path Parameters**: `id` (UUID) - Project ID
- **Auth**: Public (no authentication required)
- **Response**:

```json
{
  "success": true,
  "viewCount": 101
}
```

- **Business Logic**:
  - Uses `ProjectExistsPipe` to validate project exists
  - Calls `projectsService.incrementViewCount(id)`
  - Performs atomic SQL increment
  - Returns updated view count

---

### 10.5 Campaigns Module (`/api/campaigns`)

| #   | Method   | Route                             | Auth        | Description                        |
| --- | -------- | --------------------------------- | ----------- | ---------------------------------- |
| 1   | `GET`    | `/campaigns`                      | Public      | List all campaigns with pagination |
| 2   | `GET`    | `/campaigns/stats/summary`        | JWT (ADMIN) | Get campaign statistics            |
| 3   | `PATCH`  | `/campaigns/pins/reorder`         | JWT (ADMIN) | Reorder pinned campaigns           |
| 4   | `GET`    | `/campaigns/category/:categoryId` | Public      | Find campaigns by category         |
| 5   | `GET`    | `/campaigns/status/:status`       | Public      | Find campaigns by status           |
| 6   | `POST`   | `/campaigns`                      | JWT (ADMIN) | Create new campaign                |
| 7   | `PATCH`  | `/campaigns/:id/pin`              | JWT (ADMIN) | Toggle campaign pin state          |
| 8   | `PATCH`  | `/campaigns/:id`                  | JWT (ADMIN) | Update campaign                    |
| 9   | `DELETE` | `/campaigns/:id`                  | JWT (ADMIN) | Delete campaign                    |
| 10  | `GET`    | `/campaigns/:id`                  | Public      | Get campaign by ID with details    |
| 11  | `POST`   | `/campaigns/:id/view`             | Public      | Increment campaign view count      |

**Query Parameters (GET /campaigns):**

- `page`, `limit`, `offset`, `sortBy`, `sortOrder`, `search`

**Path Parameters:**

- `categoryId`: UUID
- `status`: draft | active | paused | completed | cancelled

**Request Body - POST /campaigns:**

```json
{
  "title": "Campaign Title",
  "slug": "campaign-slug",
  "description": "Campaign description",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "targetAmount": 50000.0,
  "categoryId": "uuid",
  "mediaIds": ["uuid1", "uuid2"],
  "status": "draft",
  "isPinned": false,
  "isActive": true,
  "isDonationActive": true,
  "isProgressActive": true,
  "isTargetAmountActive": true,
  "donationGoal": 10000.0
}
```

**POST /campaigns/:id/view** - Increment View Count:
- **Purpose**: Track campaign views for analytics and popularity ranking
- **Path Parameters**: `id` (UUID) - Campaign ID
- **Auth**: Public (no authentication required)
- **Response**:
```json
{
  "success": true,
  "viewCount": 51
}
```
- **Business Logic**: 
  - Uses `CampaignExistsPipe` to validate campaign exists
  - Calls `campaignsService.incrementViewCount(id)` 
  - Performs atomic SQL increment
  - Returns updated view count

---

### 10.6 Donations Module (`/api/donations`)

| #   | Method   | Route                                          | Auth        | Description                        |
| --- | -------- | ---------------------------------------------- | ----------- | ---------------------------------- |
| 1   | `GET`    | `/donations`                                   | Public      | List all donations with pagination |
| 2   | `GET`    | `/donations/payment-status`                    | Public      | Reconcile payment status           |
| 3   | `GET`    | `/donations/payment-status/invoice/:invoiceId` | Public      | Reconcile by invoice ID            |
| 4   | `GET`    | `/donations/payment-status/payment/:paymentId` | Public      | Reconcile by payment ID            |
| 5   | `POST`   | `/donations/payment/webhook`                   | Public      | Handle MyFatoorah webhook          |
| 6   | `POST`   | `/donations/payment/recover-webhooks`          | JWT (ADMIN) | Recover missed payments            |
| 7   | `GET`    | `/donations/payment/:paymentId`                | JWT (ADMIN) | Find donation by payment ID        |
| 8   | `GET`    | `/donations/project/:projectId`                | JWT (ADMIN) | Find donations by project          |
| 9   | `GET`    | `/donations/campaign/:campaignId`              | JWT (ADMIN) | Find donations by campaign         |
| 10  | `GET`    | `/donations/donor/:donorId`                    | JWT (ADMIN) | Find donations by donor            |
| 11  | `POST`   | `/donations`                                   | Public      | Create new donation                |
| 12  | `PATCH`  | `/donations/:id`                               | JWT (ADMIN) | Update donation                    |
| 13  | `DELETE` | `/donations/:id`                               | JWT (ADMIN) | Delete donation                    |
| 14  | `GET`    | `/donations/:id`                               | JWT (ADMIN) | Get donation by ID                 |

**Query Parameters:**

- `GET /donations`: `page`, `limit`, `offset`, `sortBy`, `sortOrder`, `search`
- `GET /donations/payment-status`: `key`, `paymentId`, `Id`, `type` (InvoiceId | PaymentId)
- `POST /donations/payment/recover-webhooks`: `hours` (optional)

**Request Body - POST /donations:**

```json
{
  "donorInfo": {
    "userId": "uuid (optional)",
    "email": "email (optional)",
    "fullName": "Full Name (optional)",
    "phoneNumber": "phone (optional)",
    "isAnonymous": false
  },
  "donationItems": [
    {
      "projectId": "uuid (required if no campaignId)",
      "campaignId": "uuid (required if no projectId)",
      "amount": 100.0
    }
  ],
  "paymentMethod": "2 (MyFatoorah payment method ID)",
  "currency": "KWD"
}
```

**Response - POST /donations:**

```json
{
  "donationIds": ["uuid1", "uuid2"],
  "paymentUrl": "https://pay.myfatoorah.com/...",
  "totalAmount": 100.0,
  "invoiceId": "INV-12345",
  "lineItems": [
    {
      "donationId": "uuid1",
      "amount": 50,
      "projectId": "uuid",
      "campaignId": null
    },
    {
      "donationId": "uuid2",
      "amount": 50,
      "projectId": null,
      "campaignId": "uuid"
    }
  ]
}
```

**Donation Status Enum:** `pending`, `paid`, `completed`, `failed`, `successful`, `cancelled`

---

### 10.7 Donor Module (`/api/donors`)

| #   | Method   | Route         | Auth | Roles              | Description                     |
| --- | -------- | ------------- | ---- | ------------------ | ------------------------------- |
| 1   | `GET`    | `/donors`     | JWT  | SUPER_ADMIN, ADMIN | List all donors with pagination |
| 2   | `POST`   | `/donors`     | JWT  | SUPER_ADMIN, ADMIN | Create new donor                |
| 3   | `GET`    | `/donors/:id` | JWT  | SUPER_ADMIN, ADMIN | Get donor by ID                 |
| 4   | `PATCH`  | `/donors/:id` | JWT  | SUPER_ADMIN, ADMIN | Update donor                    |
| 5   | `DELETE` | `/donors/:id` | JWT  | SUPER_ADMIN, ADMIN | Delete donor                    |

**Query Parameters (GET /donors):**

- `page`, `limit`, `offset`, `sortBy`, `sortOrder`, `search`

**Request Body - POST /donors:**

```json
{
  "userId": "uuid (optional)",
  "fullName": "Donor Name",
  "email": "donor@email.com",
  "phoneNumber": "+96512345678",
  "isAnonymous": false
}
```

**Donor Entity Fields:**

- `id`: UUID (PK)
- `fullName`: string (nullable)
- `email`: string (nullable)
- `phoneNumber`: string (nullable, max 50)
- `isAnonymous`: boolean (default: false)
- `userId`: UUID (nullable, unique)
- `donations`: OneToMany -> Donation

---

### 10.8 Payment Module (`/api/payment-methods`, `/api/invoices`, `/api/webhook`)

#### PaymentMethodsController (`/api/payment-methods`)

| #   | Method | Route                        | Auth   | Description                        |
| --- | ------ | ---------------------------- | ------ | ---------------------------------- |
| 1   | `GET`  | `/payment-methods/available` | Public | Get available payment methods      |
| 2   | `GET`  | `/payment-methods/supported` | Public | Get all supported payment methods  |
| 3   | `GET`  | `/payment-methods/:id`       | Public | Get payment method by ID           |
| 4   | `GET`  | `/payment-methods/health`    | Public | Health check for payment providers |

**Query Parameters:**

- `invoiceAmount`: number (optional)
- `currencyIso`: string (optional, default: KWD)
- `provider`: string (optional: myfatoorah, stripe, paymob)

**Response - GET /payment-methods/available:**

```json
{
  "paymentMethods": [
    { "id": "2", "name": "KNET", "logo": "url", "serviceCharge": 0.5 }
  ],
  "count": 1,
  "provider": "myfatoorah"
}
```

#### InvoiceController (`/api/invoices`)

| #   | Method | Route                  | Auth   | Description                |
| --- | ------ | ---------------------- | ------ | -------------------------- |
| 1   | `POST` | `/invoices`            | Public | Create invoice for payment |
| 2   | `GET`  | `/invoices/:id`        | Public | Get invoice by ID          |
| 3   | `GET`  | `/invoices/status/:id` | Public | Get invoice status         |

#### WebhookController (`/api/webhook`)

| #   | Method | Route                 | Auth   | Description               |
| --- | ------ | --------------------- | ------ | ------------------------- |
| 1   | `POST` | `/webhook/myfatoorah` | Public | Handle MyFatoorah webhook |
| 2   | `POST` | `/webhook/stripe`     | Public | Handle Stripe webhook     |

---

### 10.9 Media Module (`/api/media`)

| #   | Method   | Route                 | Auth   | Roles              | Description                    |
| --- | -------- | --------------------- | ------ | ------------------ | ------------------------------ |
| 1   | `POST`   | `/media/upload`       | JWT    | SUPER_ADMIN, ADMIN | Upload file (multipart)        |
| 2   | `GET`    | `/media`              | Public | -                  | List all media with pagination |
| 3   | `GET`    | `/media/:id/data`     | Public | -                  | Stream file data               |
| 4   | `PATCH`  | `/media/:id`          | JWT    | SUPER_ADMIN, ADMIN | Update media details           |
| 5   | `DELETE` | `/media/:id`          | JWT    | SUPER_ADMIN, ADMIN | Delete media                   |
| 6   | `POST`   | `/media/fix-encoding` | JWT    | SUPER_ADMIN        | Fix encoding for all media     |
| 7   | `GET`    | `/media/:id`          | Public | -                  | Get media by ID                |

**Upload Requirements:**

- Field name: `file`
- Max size: 10MB
- Allowed types: image/png, image/jpeg, image/jpg, image/gif, application/pdf

**Media Type Enum:** `image`, `video`, `audio`, `document`

**Media Entity Fields:**

- `id`: UUID (PK)
- `name`: string
- `path`: string
- `mimeType`: string
- `size`: number
- `type`: enum (image, video, audio, document)
- `createdAt`: timestamp
- `updatedAt`: timestamp

---

### 10.10 Banners Module (`/api/banners`)

| #   | Method   | Route                   | Auth   | Roles              | Description                      |
| --- | -------- | ----------------------- | ------ | ------------------ | -------------------------------- |
| 1   | `GET`    | `/banners`              | Public | -                  | List all banners with pagination |
| 2   | `PATCH`  | `/banners/pins/reorder` | JWT    | SUPER_ADMIN, ADMIN | Reorder pinned banners           |
| 3   | `POST`   | `/banners`              | JWT    | SUPER_ADMIN, ADMIN | Create new banner                |
| 4   | `PATCH`  | `/banners/:id/pin`      | JWT    | SUPER_ADMIN, ADMIN | Toggle banner pin state          |
| 5   | `PATCH`  | `/banners/:id`          | JWT    | SUPER_ADMIN, ADMIN | Update banner                    |
| 6   | `DELETE` | `/banners/:id`          | JWT    | SUPER_ADMIN, ADMIN | Delete banner                    |
| 7   | `GET`    | `/banners/:id`          | Public | -                  | Get banner by ID                 |

**Request Body - POST /banners:**

```json
{
  "title": "Banner Title",
  "description": "Banner description",
  "imageUrl": "https://...",
  "linkUrl": "https://...",
  "isActive": true,
  "isPinned": false
}
```

**Banner Entity Fields:**

- `id`: UUID (PK)
- `title`: text
- `description`: text (nullable)
- `imageUrl`: string
- `linkUrl`: string (nullable)
- `isActive`: boolean
- `isPinned`: boolean
- `pinnedOrder`: integer
- `createdById`: UUID (nullable)
- `createdAt`: timestamp
- `updatedAt`: timestamp

---

### 10.11 Categories Module (`/api/categories`)

| #   | Method   | Route                    | Auth        | Description                         |
| --- | -------- | ------------------------ | ----------- | ----------------------------------- |
| 1   | `GET`    | `/categories`            | Public      | List all categories with pagination |
| 2   | `POST`   | `/categories`            | JWT (ADMIN) | Create new category                 |
| 3   | `GET`    | `/categories/slug/:slug` | Public      | Get category by slug                |
| 4   | `PATCH`  | `/categories/:id`        | JWT (ADMIN) | Update category                     |
| 5   | `DELETE` | `/categories/:id`        | JWT (ADMIN) | Delete category                     |
| 6   | `GET`    | `/categories/:id`        | Public      | Get category by ID                  |

**Request Body - POST /categories:**

```json
{
  "name": "Category Name",
  "slug": "category-slug",
  "description": "Category description (optional)",
  "icon": "icon-url (optional)"
}
```

**Category Entity Fields:**

- `id`: UUID (PK)
- `name`: string
- `slug`: string (unique)
- `description`: text (nullable)
- `icon`: string (nullable)
- `createdAt`: timestamp
- `updatedAt`: timestamp

---

### 10.12 Countries Module (`/api/countries`)

| #   | Method   | Route            | Auth        | Description                        |
| --- | -------- | ---------------- | ----------- | ---------------------------------- |
| 1   | `GET`    | `/countries`     | Public      | List all countries with pagination |
| 2   | `POST`   | `/countries`     | JWT (ADMIN) | Create new country                 |
| 3   | `PATCH`  | `/countries/:id` | JWT (ADMIN) | Update country                     |
| 4   | `DELETE` | `/countries/:id` | JWT (ADMIN) | Delete country                     |
| 5   | `GET`    | `/countries/:id` | Public      | Get country by ID                  |

**Request Body - POST /countries:**

```json
{
  "name": "Country Name",
  "code": "KW",
  "flagUrl": "https://...",
  "currency": "KWD",
  "currencySymbol": "د.ك"
}
```

**Country Entity Fields:**

- `id`: UUID (PK)
- `name`: string
- `code`: string (unique, 2-3 chars)
- `flagUrl`: string (nullable)
- `currency`: string (nullable)
- `currencySymbol`: string (nullable)
- `createdAt`: timestamp
- `updatedAt`: timestamp

---

### 10.13 Continents Module (`/api/continents`)

| #   | Method   | Route             | Auth        | Description                         |
| --- | -------- | ----------------- | ----------- | ----------------------------------- |
| 1   | `GET`    | `/continents`     | Public      | List all continents with pagination |
| 2   | `POST`   | `/continents`     | JWT (ADMIN) | Create new continent                |
| 3   | `PATCH`  | `/continents/:id` | JWT (ADMIN) | Update continent                    |
| 4   | `DELETE` | `/continents/:id` | JWT (ADMIN) | Delete continent                    |
| 5   | `GET`    | `/continents/:id` | Public      | Get continent by ID                 |

**Request Body - POST /continents:**

```json
{
  "name": "Asia",
  "code": "AS"
}
```

**Continent Entity Fields:**

- `id`: UUID (PK)
- `name`: string
- `code`: string (unique, 2 chars)
- `createdAt`: timestamp
- `updatedAt`: timestamp

---

### 10.14 Home & System Module (`/api`)

| #   | Method | Route            | Auth              | Description                                    |
| --- | ------ | ---------------- | ----------------- | ---------------------------------------------- |
| 1   | `GET`  | `/`              | Public            | Health check endpoint                          |
| 2   | `GET`  | `/home/feed`     | Public            | Get main home feed with projects and campaigns |
| 3   | `GET`  | `/recover-media` | JWT (SUPER_ADMIN) | Recover and link media to projects             |

**GET /home/feed**:

- Query Parameters: `page`, `limit`, `offset`, `sortBy`, `sortOrder`, `search`
- Returns mixed content (projects, campaigns, banners) for homepage
- Response:

```json
{
  "data": {
    "pinnedProjects": [...],
    "pinnedCampaigns": [...],
    "recentProjects": [...],
    "recentCampaigns": [...],
    "banners": [...]
  },
  "meta": { "page", "limit", "offset", "total", "totalPages", "hasNextPage", "hasPrevPage" }
}
```

**POST /projects/:id/view**:

- Path Parameters: `id` (UUID)
- Auth: Public (no authentication required)
- Description: Increment project view count by 1
- Response:

```json
{
  "success": true,
  "viewCount": 101
}
```

- Business Logic: Calls `projectsService.incrementViewCount(id)` which increments `viewCount` field in database using atomic SQL increment

**POST /campaigns/:id/view**:

- Path Parameters: `id` (UUID)
- Auth: Public (no authentication required)
- Description: Increment campaign view count by 1
- Response:

```json
{
  "success": true,
  "viewCount": 50
}
```

- Business Logic: Same pattern as projects - increments `viewCount` field atomically

**GET /recover-media**:

- Auth: JWT (SUPER_ADMIN only)
- Description: Run media recovery process to match projects with media based on keyword mapping
- Response:

```json
{
  "message": "Recovery Complete",
  "restoredProjects": 5,
  "logs": ["Matched Project: Project Name --> [media/path]"]
}
```

---

## 11. Complete Entity Reference

### 11.1 User Entity

| Field        | Type      | Nullable | Constraints    | Description                                |
| ------------ | --------- | -------- | -------------- | ------------------------------------------ |
| id           | UUID      | No       | PK             | Auto-generated UUID                        |
| email        | string    | No       | Unique         | User email                                 |
| password     | string    | No       | -              | Bcrypt hashed                              |
| username     | string    | Yes      | -              | Auto-generated from email                  |
| fullName     | text      | Yes      | -              | User full name                             |
| role         | enum      | No       | Default: USER  | super_admin, admin, volunteer, donor, user |
| isVerified   | boolean   | No       | Default: false | Email verified flag                        |
| otp          | string    | Yes      | Max 6 chars    | OTP code                                   |
| otpExpires   | timestamp | Yes      | -              | OTP expiration time                        |
| refreshToken | text      | Yes      | -              | JWT refresh token                          |
| createdAt    | timestamp | No       | Auto           | Creation timestamp                         |
| updatedAt    | timestamp | No       | Auto           | Update timestamp                           |

### 11.2 Project Entity

| Field                | Type          | Nullable | Constraints    | Description                                         |
| -------------------- | ------------- | -------- | -------------- | --------------------------------------------------- |
| id                   | UUID          | No       | PK             | Auto-generated UUID                                 |
| title                | text          | No       | -              | Project name                                        |
| slug                 | string        | No       | Unique         | SEO URL slug                                        |
| description          | text          | No       | -              | Project description                                 |
| location             | text          | No       | -              | Geographic location                                 |
| startDate            | timestamp     | No       | -              | Project start date                                  |
| endDate              | timestamp     | Yes      | -              | Project end date                                    |
| targetAmount         | decimal(15,3) | No       | -              | Fundraising goal                                    |
| currentAmount        | decimal(15,3) | No       | Default: 0     | Amount raised                                       |
| status               | enum          | No       | Default: DRAFT | draft, active, funded, closed, completed, cancelled |
| isActive             | boolean       | No       | Default: true  | Active flag                                         |
| isPinned             | boolean       | No       | Default: false | Homepage pinned                                     |
| pinnedOrder          | int           | No       | Default: 0     | Pin order                                           |
| viewCount            | int           | No       | Default: 0     | View counter                                        |
| donationCount        | int           | No       | Default: 0     | Donation counter                                    |
| isDonationActive     | boolean       | No       | Default: true  | Allow donations                                     |
| isProgressActive     | boolean       | No       | Default: true  | Show progress bar                                   |
| isTargetAmountActive | boolean       | No       | Default: true  | Show target amount                                  |
| donationGoal         | decimal(15,3) | Yes      | -              | Optional donation goal                              |
| categoryId           | uuid          | No       | FK             | Category reference                                  |
| countryId            | uuid          | No       | FK             | Country reference                                   |
| continentId          | uuid          | No       | FK             | Continent reference                                 |
| createdById          | uuid          | Yes      | FK             | Creator user                                        |
| createdAt            | timestamp     | No       | Auto           | Creation timestamp                                  |
| updatedAt            | timestamp     | No       | Auto           | Update timestamp                                    |

### 11.3 Campaign Entity

| Field                | Type          | Nullable | Constraints    | Description                                 |
| -------------------- | ------------- | -------- | -------------- | ------------------------------------------- |
| id                   | UUID          | No       | PK             | Auto-generated UUID                         |
| title                | text          | No       | -              | Campaign name                               |
| slug                 | string        | No       | Unique         | SEO URL slug                                |
| description          | text          | No       | -              | Campaign description                        |
| startDate            | timestamp     | No       | -              | Campaign start                              |
| endDate              | timestamp     | Yes      | -              | Campaign end                                |
| targetAmount         | decimal(15,3) | No       | -              | Fundraising goal                            |
| currentAmount        | decimal(15,3) | No       | Default: 0     | Amount raised                               |
| status               | enum          | No       | Default: DRAFT | draft, active, paused, completed, cancelled |
| isActive             | boolean       | No       | Default: true  | Active flag                                 |
| isPinned             | boolean       | No       | Default: false | Homepage pinned                             |
| pinnedOrder          | int           | No       | Default: 0     | Pin order                                   |
| viewCount            | int           | No       | Default: 0     | View counter                                |
| donationCount        | int           | No       | Default: 0     | Donation counter                            |
| isDonationActive     | boolean       | No       | Default: true  | Allow donations                             |
| isProgressActive     | boolean       | No       | Default: true  | Show progress bar                           |
| isTargetAmountActive | boolean       | No       | Default: true  | Show target amount                          |
| donationGoal         | decimal(15,3) | Yes      | -              | Optional donation goal                      |
| categoryId           | uuid          | No       | FK             | Category reference                          |
| createdById          | uuid          | Yes      | FK             | Creator user                                |
| createdAt            | timestamp     | No       | Auto           | Creation timestamp                          |
| updatedAt            | timestamp     | No       | Auto           | Update timestamp                            |

### 11.4 Donation Entity

| Field           | Type          | Nullable | Constraints      | Description                                             |
| --------------- | ------------- | -------- | ---------------- | ------------------------------------------------------- |
| id              | UUID          | No       | PK               | Auto-generated UUID                                     |
| amount          | decimal(15,3) | No       | -                | Donation amount                                         |
| currency        | string        | No       | 3 chars          | Currency code (KWD)                                     |
| paymentMethod   | varchar       | No       | Max 50           | Provider payment method ID                              |
| status          | enum          | No       | Default: PENDING | pending, paid, completed, failed, successful, cancelled |
| idempotencyKey  | varchar       | Yes      | Unique           | Prevents duplicate donations                            |
| paymentDetails  | json          | Yes      | -                | Gateway response on creation                            |
| webhookResponse | json          | Yes      | -                | Gateway webhook payload                                 |
| paymentId       | char(36)      | Yes      | FK               | Payment reference                                       |
| paidAt          | timestamp     | Yes      | -                | Payment completion time                                 |
| projectId       | uuid          | Yes      | FK               | Target project                                          |
| campaignId      | uuid          | Yes      | FK               | Target campaign                                         |
| donorId         | uuid          | Yes      | FK               | Donor reference                                         |
| createdAt       | timestamp     | No       | Auto             | Creation timestamp                                      |
| updatedAt       | timestamp     | No       | Auto             | Update timestamp                                        |

**Indexes:** paymentId, projectId, campaignId, donorId, status

### 11.5 Payment Entity

| Field          | Type          | Nullable | Constraints | Description           |
| -------------- | ------------- | -------- | ----------- | --------------------- |
| id             | UUID          | No       | PK          | Auto-generated UUID   |
| amount         | decimal(15,3) | No       | -           | Payment amount        |
| currency       | string        | No       | 3 chars     | Currency code         |
| status         | string        | No       | -           | pending, paid, failed |
| transactionId  | string        | No       | -           | Gateway invoice ID    |
| mfPaymentId    | string        | Yes      | -           | MyFatoorah payment ID |
| customerName   | string        | Yes      | -           | Customer name         |
| customerEmail  | string        | Yes      | -           | Customer email        |
| customerMobile | string        | Yes      | -           | Customer phone        |
| paymentMethod  | string        | Yes      | -           | Payment method used   |
| rawResponse    | json          | Yes      | -           | Gateway raw response  |
| createdAt      | timestamp     | No       | Auto        | Creation timestamp    |
| updatedAt      | timestamp     | No       | Auto        | Update timestamp      |

### 11.6 Donor Entity

| Field       | Type      | Nullable | Constraints    | Description         |
| ----------- | --------- | -------- | -------------- | ------------------- |
| id          | UUID      | No       | PK             | Auto-generated UUID |
| fullName    | text      | Yes      | -              | Donor name          |
| email       | string    | Yes      | -              | Donor email         |
| phoneNumber | varchar   | Yes      | Max 50         | Phone number        |
| isAnonymous | boolean   | No       | Default: false | Anonymous flag      |
| userId      | uuid      | Yes      | Unique         | Linked user         |
| createdAt   | timestamp | No       | Auto           | Creation timestamp  |
| updatedAt   | timestamp | No       | Auto           | Update timestamp    |

### 11.7 Category Entity

| Field       | Type      | Nullable | Constraints | Description          |
| ----------- | --------- | -------- | ----------- | -------------------- |
| id          | UUID      | No       | PK          | Auto-generated UUID  |
| name        | string    | No       | -           | Category name        |
| slug        | string    | No       | Unique      | SEO URL slug         |
| description | text      | Yes      | -           | Category description |
| icon        | string    | Yes      | -           | Icon URL             |
| createdAt   | timestamp | No       | Auto        | Creation timestamp   |
| updatedAt   | timestamp | No       | Auto        | Update timestamp     |

### 11.8 Country Entity

| Field          | Type      | Nullable | Constraints | Description              |
| -------------- | --------- | -------- | ----------- | ------------------------ |
| id             | UUID      | No       | PK          | Auto-generated UUID      |
| name           | string    | No       | -           | Country name             |
| code           | string    | No       | Unique      | Country code (2-3 chars) |
| flagUrl        | string    | Yes      | -           | Flag image URL           |
| currency       | string    | Yes      | -           | Currency code            |
| currencySymbol | string    | Yes      | -           | Currency symbol          |
| createdAt      | timestamp | No       | Auto        | Creation timestamp       |
| updatedAt      | timestamp | No       | Auto        | Update timestamp         |

### 11.9 Continent Entity

| Field     | Type      | Nullable | Constraints | Description              |
| --------- | --------- | -------- | ----------- | ------------------------ |
| id        | UUID      | No       | PK          | Auto-generated UUID      |
| name      | string    | No       | -           | Continent name           |
| code      | string    | No       | Unique      | Continent code (2 chars) |
| createdAt | timestamp | No       | Auto        | Creation timestamp       |
| updatedAt | timestamp | No       | Auto        | Update timestamp         |

### 11.10 Media Entity

| Field     | Type      | Nullable | Constraints | Description                   |
| --------- | --------- | -------- | ----------- | ----------------------------- |
| id        | UUID      | No       | PK          | Auto-generated UUID           |
| name      | string    | No       | -           | File name                     |
| path      | string    | No       | -           | File path (uploads/...)       |
| mimeType  | string    | No       | -           | MIME type                     |
| size      | int       | No       | -           | File size in bytes            |
| type      | enum      | No       | -           | image, video, audio, document |
| createdAt | timestamp | No       | Auto        | Creation timestamp            |
| updatedAt | timestamp | No       | Auto        | Update timestamp              |

### 11.11 Banner Entity

| Field       | Type      | Nullable | Constraints    | Description         |
| ----------- | --------- | -------- | -------------- | ------------------- |
| id          | UUID      | No       | PK             | Auto-generated UUID |
| title       | text      | No       | -              | Banner title        |
| description | text      | Yes      | -              | Banner description  |
| imageUrl    | string    | No       | -              | Banner image URL    |
| linkUrl     | string    | Yes      | -              | Click-through URL   |
| isActive    | boolean   | No       | Default: true  | Active flag         |
| isPinned    | boolean   | No       | Default: false | Pinned flag         |
| pinnedOrder | int       | No       | Default: 0     | Display order       |
| createdById | uuid      | Yes      | FK             | Creator user        |
| createdAt   | timestamp | No       | Auto           | Creation timestamp  |
| updatedAt   | timestamp | No       | Auto           | Update timestamp    |

---

## 12. DTO Reference

### 12.1 PaginationQueryDto

```typescript
class PaginationQueryDto {
  page?: number = 1; // Min: 1
  limit?: number = 10; // Min: 1, Max: 100
  offset?: number; // Min: 0
  search?: string;
  sortBy?: string = 'createdAt';
  sortOrder?: SortOrder = DESC;
}
```

### 12.2 CreateProjectDto (Partial)

```typescript
class CreateProjectDto {
  @IsString() @IsNotEmpty() title: string;
  @IsString() @IsNotEmpty() slug: string;
  @IsString() description: string;
  @IsString() location: string;
  @IsDate() startDate: Date;
  @IsDate() @IsOptional() endDate?: Date;
  @IsDecimal() targetAmount: number;
  @IsUUID() categoryId: string;
  @IsUUID() countryId: string;
  @IsUUID() continentId: string;
  @IsArray() @IsOptional() @IsUUID('4', { each: true }) mediaIds?: string[];
  @IsBoolean() @IsOptional() isPinned?: boolean;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsBoolean() @IsOptional() isDonationActive?: boolean;
  @IsBoolean() @IsOptional() isProgressActive?: boolean;
  @IsBoolean() @IsOptional() isTargetAmountActive?: boolean;
  @IsDecimal() @IsOptional() donationGoal?: number;
}
```

### 12.3 CreateDonationDto

```typescript
class CreateDonationDto {
  @ValidateNested() donorInfo: {
    @IsUUID('4') @IsOptional() userId?: string;
    @IsEmail() @IsOptional() email?: string;
    @IsString() @IsOptional() fullName?: string;
    @IsString() @IsOptional() phoneNumber?: string;
    @IsBoolean() @IsOptional() isAnonymous?: boolean;
  };

  @IsArray() @ValidateNested({ each: true }) donationItems: {
    @IsUUID('4') @IsOptional() projectId?: string;
    @IsUUID('4') @IsOptional() campaignId?: string;
    @IsDecimal() amount: number;
  }[];

  @IsString() paymentMethod: string;
  @IsString() @IsOptional() currency?: string = 'KWD';
}
```

---

## 13. Validation Rules Summary

### Common Validation Decorators Used

- `@IsNotEmpty()` - Required fields
- `@IsString()` - String type
- `@IsEmail()` - Email format
- `@IsUUID()` - UUID format validation
- `@IsNumber()` - Number type
- `@IsDecimal()` - Decimal numbers
- `@IsBoolean()` - Boolean type
- `@IsDate()` - Date type
- `@IsArray()` - Array type
- `@ValidateNested()` - Nested object validation
- `@IsOptional()` - Optional field
- `@Min()`, `@Max()` - Number constraints
- `@IsEnum()` - Enum validation
- `@MaxLength()`, `@MinLength()` - String length

---

## 14. Error Handling

### HTTP Status Codes Used

| Code | Usage                           |
| ---- | ------------------------------- |
| 200  | Successful GET, PATCH           |
| 201  | Successful POST (created)       |
| 400  | Validation errors, bad request  |
| 401  | Unauthorized (invalid token)    |
| 403  | Forbidden (insufficient role)   |
| 404  | Resource not found              |
| 409  | Conflict (duplicate slug, etc.) |
| 422  | Unprocessable entity            |
| 500  | Internal server error           |

### Error Response Format

```json
{
  "message": "Error description",
  "error": "Bad Request",
  "statusCode": 400
}
```

---

## 15. Role-Based Access Matrix

| Endpoint                   | PUBLIC | USER | VOLUNTEER | ADMIN | SUPER_ADMIN |
| -------------------------- | ------ | ---- | --------- | ----- | ----------- |
| GET /auth/register         | ✓      | -    | -         | -     | -           |
| GET /auth/login            | ✓      | -    | -         | -     | -           |
| GET /auth/profile          | -      | ✓    | ✓         | ✓     | ✓           |
| GET /projects              | ✓      | ✓    | ✓         | ✓     | ✓           |
| POST /projects             | -      | -    | -         | ✓     | ✓           |
| GET /users                 | -      | -    | -         | ✓     | ✓           |
| POST /users                | -      | -    | -         | ✓     | ✓           |
| DELETE /users/:id          | -      | -    | -         | -     | ✓           |
| POST /admin/users/:id/role | -      | -    | -         | -     | ✓           |

---

## 16. Performance Notes

### Query Optimization

- **Eager Loading**: Category, Country, Continent, Media loaded automatically in list queries
- **Pagination**: Uses `getManyAndCount()` for efficient count + data retrieval
- **Search**: ILIKE pattern matching on title, description, slug fields
- **Pinned Items**: Sorted first by `isPinned DESC`, then `pinnedOrder ASC`

### N+1 Prevention

- TypeORM relations with `leftJoinAndSelect` in QueryBuilder
- Count queries separated from data queries
- Batch updates in reorder operations

### Indexes (Implicit)

- Primary keys (UUID)
- Unique constraints (slug, email, userId)
- Foreign keys (categoryId, countryId, campaignId, donorId, paymentId)
- Status fields for filtering

---

## 17. Known Limitations & Improvements Needed

1.  **No Soft Delete**: Entities use hard delete; consider adding deletedAt column
2.  **Limited Caching**: Public endpoints could benefit from Redis caching
3.  **No Rate Limiting**: Consider adding throttling for public endpoints
4.  **Media Storage**: Local filesystem; should migrate to S3/Cloud storage
5.  **No WebSocket**: Real-time features not implemented
6.  **Payment Providers**: Only MyFatoorah fully integrated; Stripe/PayMob planned
7.  **Search**: Basic LIKE search; consider Elasticsearch for advanced search
8.  **Pagination**: No cursor-based pagination for infinite scroll

---

## 18. API Design Standards

This section defines the mandatory architectural rules for all API implementations in this backend. AI agents MUST follow these standards when modifying or extending the API.

### 18.1 Data Type Standards

| Standard            | Rule                           | Example                                  |
| ------------------- | ------------------------------ | ---------------------------------------- |
| **ID Format**       | All IDs use UUID v4            | `"550e8400-e29b-41d4-a716-446655440000"` |
| **Timestamps**      | All timestamps use ISO8601 UTC | `"2024-01-15T10:30:00.000Z"`             |
| **Case Convention** | All responses use camelCase    | `fullName`, `createdAt`, `isActive`      |
| **Monetary Fields** | Use decimal(15,3)              | `targetAmount: 10000.000`                |
| **Currency Codes**  | 3-character ISO codes          | `"KWD"`, `"USD"`, `"EUR"`                |

### 18.2 Endpoint Standards

| Standard              | Rule                                                         |
| --------------------- | ------------------------------------------------------------ |
| **Pagination**        | All list endpoints MUST support pagination                   |
| **Response Wrapper**  | Use standardized CollectionResponseDto                       |
| **Controller Output** | Controllers return DTOs only, NEVER expose entities directly |
| **Validation**        | Validation is mandatory for all external input               |
| **Error Format**      | Use standardized error response format                       |

### 18.3 Validation Standards

| Rule                     | Implementation                                   |
| ------------------------ | ------------------------------------------------ |
| **Mandatory Validation** | All DTOs must use class-validator decorators     |
| **Transform Enabled**    | ValidationPipe transform option enabled globally |
| **Whitelist Enabled**    | Unknown properties are stripped from requests    |
| **Type Coercion**        | Automatic type conversion enabled                |

### 18.4 Response Standards

```typescript
// Collection Response
interface CollectionResponseDto<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    offset: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Single Response
interface SingleResponseDto<T> {
  data: T;
}

// Error Response
interface ErrorResponseDto {
  message: string;
  error: string;
  statusCode: number;
  details?: any;
}
```

---

## 19. Route Naming Conventions

All routes in this backend MUST follow these naming rules to ensure consistency and prevent route conflicts.

### 19.1 Mandatory Rules

| Rule                 | Correct                                           | Incorrect                      |
| -------------------- | ------------------------------------------------- | ------------------------------ |
| **Plural Resources** | `/projects`                                       | `/project`                     |
| **Kebab-case**       | `/payment-methods`                                | `/paymentMethods`              |
| **HTTP Methods**     | PATCH for partial updates                         | POST for updates               |
| **Static First**     | `/projects/status/:status` BEFORE `/projects/:id` | Reversed order causes conflict |
| **No Verbs**         | `/projects/:id/pin`                               | `/projects/:id/toggle-pin`     |

### 19.2 Route Precedence in NestJS

**WARNING**: NestJS processes routes in the order they are declared. Static routes MUST be declared BEFORE dynamic routes to prevent conflicts.

**Conflict Example:**

```typescript
// ❌ WRONG - Dynamic route before static route causes conflict
@Controller('projects')
export class ProjectsController {
  @Get(':id')              // This catches ALL requests including 'status'
  getById(@Param('id') id: string) { ... }

  @Get('status/:status')   // NEVER REACHED - ':id' matches 'status' first
  getByStatus(@Param('status') status: string) { ... }
}

// ✅ CORRECT - Static routes declared first
@Controller('projects')
export class ProjectsController {
  @Get('status/:status')   // FIRST - Static path with parameter
  getByStatus(@Param('status') status: string) { ... }

  @Get('category/:categoryId') // SECOND - Another static path
  getByCategory(@Param('categoryId') id: string) { ... }

  @Get(':id')              // LAST - Catch-all dynamic route
  getById(@Param('id') id: string) { ... }
}
```

### 19.3 Nested Resource Rules

| Rule                    | Example                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| **Avoid Deep Nesting**  | `/projects/:id/donations` is OK, but avoid `/projects/:id/donations/:donationId/refunds` |
| **Prefer Flat Design**  | Use `/donations?projectId=:id` instead of `/projects/:id/donations` for filtering        |
| **Limit Nesting Depth** | Maximum 2 levels of nesting                                                              |

### 19.4 Current Route Precedence (Verified Safe)

The following routes are declared in correct order - no conflicts:

```text
GET    /projects                    → List (no param)
GET    /projects/stats/summary      → Static (before :id)
GET    /projects/category/:id       → Static with param (before :id)
GET    /projects/country/:id        → Static with param (before :id)
GET    /projects/status/:status     → Static with param (before :id)
GET    /projects/:id                 → Dynamic (LAST)

Same pattern applies to: campaigns, donations, donors, banners
```

---

## 20. AI Modification Rules

AI agents (Cursor, Claude Code, Devin, OpenHands, Windsurf) MUST follow these rules when modifying the backend. Violating these rules may break existing functionality or create inconsistencies.

### 20.1 Duplicate Prevention Rules

| Rule                            | Implementation                                                                |
| ------------------------------- | ----------------------------------------------------------------------------- |
| **No Duplicate Endpoints**      | NEVER create new endpoints that perform the same function as existing ones    |
| **No Duplicate Business Logic** | NEVER copy-paste logic from one service to another; extract to shared utility |
| **Reuse Existing DTOs**         | Use existing PaginationQueryDto, CollectionResponseDto for all list endpoints |
| **Reuse Services**              | Never duplicate service methods; extend existing services instead             |

### 20.2 Extension Rules

| Rule                       | Implementation                                              |
| -------------------------- | ----------------------------------------------------------- |
| **Prefer Extension**       | Extend existing endpoints rather than creating new ones     |
| **Backward Compatibility** | Preserve existing route signatures and response formats     |
| **Route Stability**        | NEVER change existing route paths or HTTP methods           |
| **Auth Preservation**      | NEVER remove or weaken existing guards and role constraints |

### 20.3 Architecture Rules

| Rule                            | Implementation                                 |
| ------------------------------- | ---------------------------------------------- |
| **Service Layer Only**          | Business logic MUST reside in services only    |
| **Thin Controllers**            | Controllers must only validate and orchestrate |
| **No Direct Repository Access** | NEVER access repositories from controllers     |
| **DTO Validation**              | All external input MUST be validated via DTOs  |

### 20.4 Forbidden Actions

```typescript
// ❌ FORBIDDEN - Creating duplicate endpoint
@Get('projects/all')
getAllProjects() { ... }  // Already exists at GET /projects

// ❌ FORBIDDEN - Duplicating business logic
async createProject(dto: CreateProjectDto) {
  // Copy-paste from another service
}

// ❌ FORBIDDEN - Bypassing service layer
@Post('projects')
async create(@Body() dto: CreateProjectDto) {
  const project = this.repo.create(dto);  // Direct repo access
  return this.repo.save(project);         // NO!
}

// ❌ FORBIDDEN - Removing auth
@Post('projects')  // Was: @UseGuards(JwtAuthGuard)
create(...) { ... }

// ✅ CORRECT - Extending via service
@Patch('projects/:id')
async update(...) {
  return this.projectsService.updateWithNotification(id, dto);  // Adds notification logic
}
```

---

## 21. Architectural Constraints

This section documents the hard boundaries of the system. These constraints MUST NOT be violated.

### 21.1 Layer Boundaries

| Constraint                     | Description                                                   |
| ------------------------------ | ------------------------------------------------------------- |
| **Business Logic in Services** | All business logic must be in service classes                 |
| **Controllers Orchestrate**    | Controllers only validate input, call services, format output |
| **Repositories Encapsulated**  | Repositories are injected into services only                  |
| **Entities Persistence-Only**  | Entities represent database structure only                    |

### 21.2 Security Constraints

| Constraint              | Description                                           |
| ----------------------- | ----------------------------------------------------- |
| **Payment Secrets**     | NEVER expose payment gateway secrets in API responses |
| **Webhook Idempotency** | Webhook handlers MUST be idempotent                   |
| **Outbox Atomicity**    | Outbox processing MUST remain transactional           |

### 21.3 Data Constraints

| Constraint             | Description                           |
| ---------------------- | ------------------------------------- |
| **Monetary Precision** | All monetary values use decimal(15,3) |
| **Timestamps**         | All timestamps stored as UTC          |
| **UUID IDs**           | All primary keys use UUID v4          |

### 21.4 Centralization Constraints

| Constraint            | Implementation                               |
| --------------------- | -------------------------------------------- |
| **Pagination Logic**  | MUST use PaginationService.normalizeParams() |
| **Response Wrapping** | MUST use CollectionResponseDto               |
| **Error Handling**    | MUST use NestJS built-in exceptions          |

---

## 22. QueryBuilder & Database Standards

All database queries in this backend MUST follow these standards for performance and maintainability.

### 22.1 QueryBuilder Requirements

| Standard                | Implementation                                                   |
| ----------------------- | ---------------------------------------------------------------- |
| **Paginated Endpoints** | ALWAYS use QueryBuilder for paginated list endpoints             |
| **Complex Joins**       | Avoid repository.find() for queries with multiple joins          |
| **Minimal Payload**     | Use select() to fetch only required fields                       |
| **Eager Loading**       | Use leftJoinAndSelect only when relations are needed in response |

### 22.2 N+1 Prevention

```typescript
// ❌ WRONG - N+1 query problem
const projects = await this.repo.find();
for (const project of projects) {
  project.category = await this.categoryRepo.findOne(project.categoryId); // N+1!
}

// ✅ CORRECT - Single query with JOIN
const projects = await this.repo
  .createQueryBuilder('project')
  .leftJoinAndSelect('project.category', 'category')
  .getMany();
```

### 22.3 Pagination Query Pattern

```typescript
// ✅ STANDARD PAGINATION QUERY
async list(query: PaginationQueryDto): Promise<CollectionResponseDto<Project>> {
  const params = this.paginationService.normalizeParams(query);
  const { skip, take, search } = params;

  const queryBuilder = this.projectRepository
    .createQueryBuilder('project')
    .leftJoinAndSelect('project.category', 'category')
    .leftJoinAndSelect('project.country', 'country');

  if (search) {
    queryBuilder.andWhere(
      '(project.title LIKE :search OR project.description LIKE :search)',
      { search: `%${search}%` }
    );
  }

  queryBuilder
    .orderBy('project.isPinned', 'DESC')
    .addOrderBy('project.pinnedOrder', 'ASC')
    .addOrderBy(`project.${query.sortBy || 'createdAt'}`, query.sortOrder || 'DESC');

  const [data, total] = await queryBuilder
    .skip(skip)
    .take(take)
    .getManyAndCount();

  return this.paginationService.createResponse(data, total, query);
}
```

### 22.4 Indexing Recommendations

| Table     | Recommended Indexes                                    |
| --------- | ------------------------------------------------------ |
| projects  | status, categoryId, countryId, isPinned, slug (unique) |
| campaigns | status, categoryId, isPinned, slug (unique)            |
| donations | status, paymentId, projectId, campaignId, donorId      |
| donors    | email, userId (unique)                                 |
| users     | email (unique), role                                   |

---

## 23. Swagger/OpenAPI Standards

All endpoints MUST be documented with proper Swagger decorators. This ensures AI agents can understand API contracts.

### 23.1 Required Decorators

| Decorator        | Usage                     |
| ---------------- | ------------------------- |
| `@ApiTags`       | Group endpoints by module |
| `@ApiOperation`  | Describe endpoint purpose |
| `@ApiResponse`   | Document response codes   |
| `@ApiBearerAuth` | Mark protected endpoints  |
| `@ApiQuery`      | Document query parameters |
| `@ApiParam`      | Document path parameters  |
| `@ApiProperty`   | Document DTO fields       |

### 23.2 DTO Documentation Requirements

```typescript
// ✅ CORRECT - Fully documented DTO
export class CreateProjectDto {
  @ApiProperty({ example: 'Project Title', description: 'Project name' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'project-slug', description: 'SEO URL slug' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: 10000.0, description: 'Target amount in KWD' })
  @IsDecimal()
  @Min(0)
  targetAmount: number;
}
```

### 23.3 Pagination Metadata Documentation

Every paginated endpoint MUST document the response metadata:

```typescript
// ✅ CORRECT - Document pagination in response
@ApiResponse({
  status: 200,
  description: 'Paginated projects list',
  schema: {
    example: {
      data: [...],
      meta: {
        page: 1,
        limit: 10,
        offset: 0,
        total: 100,
        totalPages: 10,
        hasNextPage: true,
        hasPrevPage: false
      }
    }
  }
})
```

### 23.4 Forbidden Terminology

⚠️ **IMPORTANT**: Remove ALL occurrences of the following terms from DTO names and endpoint descriptions:

- "Paginated"
- "\*Paginated"
- "paginated"

Use instead:

- `CollectionResponseDto`
- `PaginationQueryDto`

### 23.5 Enum Documentation

```typescript
// ✅ CORRECT - Fully documented enum
export enum ProjectStatus {
  @ApiProperty({ enum: ProjectStatus, enumName: 'ProjectStatus', description: 'Draft status' })
  DRAFT = 'draft',

  @ApiProperty({ enum: ProjectStatus, enumName: 'ProjectStatus', description: 'Active status' })
  ACTIVE = 'active',

  @ApiProperty({ enum: ProjectStatus, enumName: 'ProjectStatus', description: 'Completed status' })
  COMPLETED = 'completed'
}
```

---

## 24. Pagination Architecture (Detailed)

This section provides comprehensive pagination guidance for AI agents.

### 24.1 Query Parameter Precedence

| Parameter               | Behavior                                               |
| ----------------------- | ------------------------------------------------------ |
| **offset provided**     | `page` is IGNORED entirely; offset takes precedence    |
| **offset NOT provided** | `page` is used to calculate offset internally          |
| **limit**               | Controls page size (default: 10, max: 100)             |
| **page**                | Translated internally to: offset = (page - 1) \* limit |

### 24.2 Internal Implementation

```typescript
// PaginationService.normalizeParams() implementation
normalizeParams(query: PaginationQueryDto): IPaginationParams {
  const limit = this.normalizeLimit(query.limit);    // min: 1, max: 100, default: 10
  const page = this.normalizePage(query.page);       // min: 1, default: 1
  const offset = this.normalizeOffset(query.offset); // min: 0

  let skip: number;

  // offset takes precedence over page calculation
  if (offset !== undefined && offset !== null) {
    skip = Math.max(MIN_OFFSET, offset);
  } else {
    skip = (page - 1) * limit;  // page-based calculation
  }

  return {
    skip,
    take: limit,
    order: { [query.sortBy || 'createdAt']: query.sortOrder || 'DESC' },
    search: query.search
  };
}
```

### 24.3 Response Metadata Requirements

Every paginated response MUST include:

```json
{
  "data": [...],
  "meta": {
    "page": 1,           // Current page number
    "limit": 10,         // Items per page
    "offset": 0,         // Total items skipped
    "total": 100,        // Total items matching query
    "totalPages": 10,    // Total pages available
    "hasNextPage": true, // Boolean - more pages available
    "hasPrevPage": false // Boolean - previous page exists
  }
}
```

### 24.4 Pagination Support Matrix

| Endpoint        | Supports Pagination | QueryBuilder Used | Search Supported |
| --------------- | ------------------- | ----------------- | ---------------- |
| GET /projects   | YES                 | YES               | YES              |
| GET /campaigns  | YES                 | YES               | YES              |
| GET /donations  | YES                 | YES               | YES              |
| GET /donors     | YES                 | YES               | YES              |
| GET /users      | YES                 | YES               | YES              |
| GET /media      | YES                 | YES               | YES              |
| GET /banners    | YES                 | YES               | YES              |
| GET /categories | YES                 | YES               | YES              |
| GET /countries  | YES                 | YES               | YES              |
| GET /continents | YES                 | YES               | YES              |

---

## 25. Service Dependency Graphs

Understanding service dependencies is critical for AI agents to modify code without breaking existing functionality.

### 25.1 DonationService Dependencies

```
DonationService
├── PaymentGatewayService (MyFatoorah integration)
│   ├── axios (HTTP client)
│   └── Payment entity
├── ProjectsService (updates project amounts)
│   └── Project entity
├── CampaignsService (updates campaign amounts)
│   └── Campaign entity
├── DonorService (donor resolution/creation)
│   └── Donor entity
├── OutboxService (event-driven processing)
│   └── OutboxEvent entity
└── NotificationService (user notifications)
```

### 25.2 ProjectsService Dependencies

```
ProjectsService
├── CategoryService (category validation)
│   └── Category entity
├── CountryService (country validation)
│   └── Country entity
├── ContinentService (continent validation)
│   └── Continent entity
├── MediaService (media validation)
│   └── Media entity
└── PaginationService (list operations)
```

### 25.3 CampaignsService Dependencies

```
CampaignsService
├── CategoryService (category validation)
├── MediaService (media validation)
└── PaginationService (list operations)
```

### 25.4 AuthService Dependencies

```
AuthService
├── UsersService (user management)
├── JwtService (token generation)
├── OtpService (OTP generation/verification)
└── AppConfigService (configuration)
```

### 25.5 MediaService Dependencies

```
MediaService
├── File system (local storage in /uploads)
└── Media entity
```

### 25.6 Dependency Injection Pattern

```typescript
// Services SHOULD NOT be injected into controllers
// Controllers inject Services only

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    // Thin controller - only orchestrates
    return this.projectsService.list(query);
  }
}

// Complex services inject OTHER services
@Injectable()
export class DonationService {
  constructor(
    private readonly paymentService: PaymentService, // ✅ Correct
    private readonly projectsService: ProjectsService, // ✅ Correct
    private readonly donorService: DonorsService, // ✅ Correct
    private readonly outboxService: OutboxService, // ✅ Correct
  ) {}
}
```

---

## 26. Refactor Warnings & Known Issues

This section documents known issues and potential problems to help AI agents avoid breaking changes.

### 26.1 Route Conflict Risks

| Issue                                               | Status      | Resolution                            |
| --------------------------------------------------- | ----------- | ------------------------------------- |
| `/projects/:id` vs `/projects/status/:status`       | ✅ RESOLVED | Static routes declared before dynamic |
| `/campaigns/:id` vs `/campaigns/status/:status`     | ✅ RESOLVED | Same pattern applied                  |
| `/donations/:id` vs `/donations/payment/:paymentId` | ✅ RESOLVED | Different path structures             |

### 26.2 Tight Coupling Areas

| Area               | Issue                                            | Mitigation                          |
| ------------------ | ------------------------------------------------ | ----------------------------------- |
| Donation → Payment | DonationService directly creates Payment records | Consider PaymentFactory pattern     |
| Project → Category | Project has direct foreign key dependency        | Consider soft delete for categories |
| Media → FileSystem | MediaService couples to local filesystem         | Plan: migrate to S3                 |

### 26.3 Missing Infrastructure

| Missing                 | Impact                                    | Priority |
| ----------------------- | ----------------------------------------- | -------- |
| **Soft Delete**         | Hard deletes can cause orphaned records   | MEDIUM   |
| **Rate Limiting**       | No protection against abuse               | MEDIUM   |
| **Redis Caching**       | Repeated DB queries for public data       | HIGH     |
| **Queue Workers**       | Outbox processing is synchronous          | HIGH     |
| **Soft Delete Cascade** | Deleting category doesn't handle projects | LOW      |

### 26.4 Planned Improvements (NOT YET IMPLEMENTED)

> ⚠️ **IMPORTANT**: The following features are PLANNED but NOT YET IMPLEMENTED. Do NOT describe them as existing functionality.

| Feature                | Description                           | Status  |
| ---------------------- | ------------------------------------- | ------- |
| **Redis Caching**      | Cache frequently accessed public data | PLANNED |
| **BullMQ Workers**     | Background job processing for outbox  | PLANNED |
| **S3 Storage**         | Cloud storage for media files         | PLANNED |
| **Soft Delete**        | Add deletedAt column to all entities  | PLANNED |
| **Rate Limiting**      | Add throttling for public endpoints   | PLANNED |
| **Stripe Integration** | Additional payment provider           | PLANNED |
| **PayMob Integration** | Additional payment provider           | PLANNED |
| **Elasticsearch**      | Advanced search capabilities          | PLANNED |

---

## 27. AI Runtime Context Notes

This section provides AI agents with critical context for understanding the backend architecture.

### 27.1 Critical Modules

| Module              | Criticality | Reason                                   |
| ------------------- | ----------- | ---------------------------------------- |
| **DonationService** | CRITICAL    | Core revenue flow, complex transactions  |
| **PaymentService**  | CRITICAL    | Payment processing, external integration |
| **AuthService**     | CRITICAL    | Security, token management               |
| **OutboxService**   | HIGH        | Data consistency, idempotency            |

### 27.2 Transactional Modules

The following modules perform database transactions and require careful handling:

| Module          | Transaction Type                         |
| --------------- | ---------------------------------------- |
| DonationService | Multi-table transactions, atomic updates |
| PaymentService  | Payment state management                 |
| ProjectsService | Project/Campaign updates with donations  |

### 27.3 Public-Facing Endpoints

The following endpoints are accessible WITHOUT authentication:

```text
GET    /projects
GET    /projects/:id
GET    /projects/category/:categoryId
GET    /projects/country/:countryId
GET    /projects/status/:status
GET    /campaigns
GET    /campaigns/:id
GET    /campaigns/category/:categoryId
GET    /campaigns/status/:status
GET    /donations
GET    /donations/payment-status
POST   /donations/payment/webhook
POST   /donations
GET    /media
GET    /media/:id
GET    /media/:id/data
GET    /banners
GET    /banners/:id
GET    /categories
GET    /categories/:id
GET    /categories/slug/:slug
GET    /countries
GET    /countries/:id
GET    /continents
GET    /continents/:id
POST   /auth/register
POST   /auth/login
POST   /auth/otp-verify
GET    /payment-methods/available
GET    /payment-methods/supported
GET    /payment-methods/:id
GET    /payment-methods/health
```

### 27.4 Sensitive Endpoints

The following endpoints require elevated privileges:

| Endpoint                                 | Required Role      |
| ---------------------------------------- | ------------------ |
| POST /projects                           | ADMIN, SUPER_ADMIN |
| PATCH /projects/:id                      | ADMIN, SUPER_ADMIN |
| DELETE /projects/:id                     | ADMIN, SUPER_ADMIN |
| POST /campaigns                          | ADMIN, SUPER_ADMIN |
| POST /donations/payment/recover-webhooks | ADMIN, SUPER_ADMIN |
| GET /users                               | ADMIN, SUPER_ADMIN |
| POST /admin/users/:id/role               | SUPER_ADMIN        |
| DELETE /admin/users/:id                  | SUPER_ADMIN        |
| POST /media/upload                       | ADMIN, SUPER_ADMIN |
| DELETE /media/:id                        | ADMIN, SUPER_ADMIN |

### 27.5 Backward Compatibility Requirements

When modifying the backend, AI agents MUST maintain:

1. **Route Signatures**: Don't change existing paths or HTTP methods
2. **Response Format**: Don't change structure of existing responses
3. **Authentication**: Don't weaken existing guards
4. **Authorization**: Don't reduce role requirements
5. **Pagination**: Keep existing pagination behavior
6. **Error Codes**: Maintain existing HTTP status codes

---

## 28. Performance Engineering Notes

This section provides guidance for optimizing backend performance.

### 28.1 Pagination Performance

| Strategy                | Implementation                              |
| ----------------------- | ------------------------------------------- |
| **Count Separation**    | Separate count query from data query        |
| **Select Minimization** | Use .select() to fetch only needed fields   |
| **Index Utilization**   | Ensure indexes exist on filter/sort columns |
| **Eager Loading**       | Use leftJoinAndSelect only when needed      |

### 28.2 Query Optimization Strategies

```typescript
// ✅ OPTIMIZED - Minimal select for list view
const queryBuilder = this.projectRepository
  .createQueryBuilder('project')
  .select(['project.id', 'project.title', 'project.slug', 'project.status'])
  .leftJoin('project.category', 'category')
  .addSelect(['category.id', 'category.name'])
  .skip(offset)
  .take(limit);

// ❌ NOT OPTIMIZED - Fetches all columns unnecessarily
const projects = await this.projectRepository.find({
  relations: ['category', 'country', 'continent', 'media'],
});
```

### 28.3 Caching Candidates

The following endpoints are READ-HEAVY and should be cached:

| Endpoint                       | Cache Strategy | TTL       |
| ------------------------------ | -------------- | --------- |
| GET /projects                  | Redis          | 5 minutes |
| GET /campaigns                 | Redis          | 5 minutes |
| GET /categories                | Redis          | 1 hour    |
| GET /countries                 | Redis          | 1 hour    |
| GET /banners                   | Redis          | 5 minutes |
| GET /payment-methods/available | Redis          | 1 minute  |

### 28.4 Future Architecture: Queue Workers

Planned background processing architecture:

```text
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT (Synchronous)                   │
├─────────────────────────────────────────────────────────────┤
│  Webhook → DonationService → OutboxService (in-request)    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    PLANNED (Asynchronous)                  │
├─────────────────────────────────────────────────────────────┤
│  Webhook → Queue (BullMQ) → Worker → OutboxService         │
│  Benefits: Scale independently, retry failed jobs          │
└─────────────────────────────────────────────────────────────┘
```

### 28.5 Database Indexing Guidance

| Query Pattern                                | Index Recommendation                         |
| -------------------------------------------- | -------------------------------------------- |
| `WHERE status = ?`                           | Single column index on status                |
| `WHERE categoryId = ? AND status = ?`        | Composite index (categoryId, status)         |
| `WHERE isPinned = true ORDER BY pinnedOrder` | Composite index (isPinned, pinnedOrder)      |
| `WHERE slug = ?`                             | Unique index on slug                         |
| `ORDER BY createdAt DESC`                    | Index on createdAt (consider covering index) |

---

## 29. Controller Responsibility Rules

This section defines the strict responsibilities of controllers vs services.

### 29.1 Controller Responsibilities (ALLOWED)

| Responsibility         | Example                                          |
| ---------------------- | ------------------------------------------------ |
| **Extract Parameters** | Get path params, query params, body from request |
| **Validate DTOs**      | Use @Body() with validated DTO                   |
| **Call Services**      | Delegate to service methods                      |
| **Format Response**    | Return service response directly                 |
| **Apply Guards**       | Use @UseGuards, @Roles decorators                |
| **Apply Decorators**   | Use @ApiTags, @ApiOperation                      |

### 29.2 Controller Responsibilities (FORBIDDEN)

```typescript
// ❌ FORBIDDEN - Business logic in controller
@Post('projects')
async create(@Body() dto: CreateProjectDto) {
  // DON'T: Validate category exists
  const category = await this.categoryRepo.findOne(dto.categoryId);
  if (!category) throw new NotFoundException('Category not found');

  // DON'T: Create project with custom logic
  const project = this.repo.create(dto);
  project.slug = this.generateSlug(dto.title);  // Business logic!

  // DON'T: Save directly
  return this.repo.save(project);
}

// ✅ CORRECT - Delegate to service
@Post('projects')
@UseGuards(JwtAuthGuard)
@Roles(Role.ADMIN)
async create(@Body() dto: CreateProjectDto, @Request() req) {
  return this.projectsService.create(dto, req.user);
}
```

### 29.3 Service Responsibilities (MANDATORY)

| Responsibility          | Implementation                      |
| ----------------------- | ----------------------------------- |
| **Business Logic**      | All domain logic in service methods |
| **Database Operations** | All repository calls in services    |
| **Validation**          | Business rules validation           |
| **Transactions**        | Multi-step operations               |
| **External Calls**      | Payment gateway, notifications      |

### 29.4 DTO Responsibilities

| Responsibility         | Implementation                          |
| ---------------------- | --------------------------------------- |
| **Input Sanitization** | Clean external input                    |
| **Type Conversion**    | Transform strings to types              |
| **Validation**         | Enforce required fields, formats        |
| **Documentation**      | Swagger decorators for AI understanding |

---

## 30. Documentation Integrity Rules

This section ensures documentation accurately reflects the system.

### 30.1 Content Classification

| Classification  | Description                        | Examples                       |
| --------------- | ---------------------------------- | ------------------------------ |
| **Implemented** | Features currently in production   | JWT auth, TypeORM, MyFatoorah  |
| **Planned**     | Approved for future implementation | Redis caching, BullMQ workers  |
| **Proposed**    | Ideas under consideration          | Elasticsearch, advanced search |
| **Deprecated**  | Will be removed                    | Legacy payment methods         |

### 30.2 Content Verification

| Rule                         | Implementation                                          |
| ---------------------------- | ------------------------------------------------------- |
| **Verify Before Describing** | Don't describe non-existent features                    |
| **Check Source Code**        | Confirm implementation before documenting               |
| **Mark Speculation**         | Use "Planned", "Future", "Proposed" for non-implemented |
| **Version Control**          | Update documentation when code changes                  |

### 30.3 Anti-Hallucination Guidelines

> ⚠️ **CRITICAL**: AI agents must NOT describe functionality that does not exist in the codebase.

```markdown
// ❌ INCORRECT - Describes non-existent feature

## Payment Caching

The system uses Redis to cache payment method queries for 1 hour.

# ✅ CORRECT - Describes actual feature

## Payment Methods

Payment methods are fetched directly from MyFatoorah API on each request.

// ❌ INCORRECT - Describes planned feature as existing

## Background Processing

The outbox is processed by BullMQ workers.

// ✅ CORRECT - Marks as planned

## Background Processing (PLANNED)

Future implementation will use BullMQ workers for outbox processing.
Currently, processing is synchronous.
```

---

## 31. Backend Engineering Best Practices

This section codifies engineering standards for this backend.

### 31.1 Idempotency Standards

| Standard               | Implementation                               |
| ---------------------- | -------------------------------------------- |
| **Webhook Handlers**   | Must handle duplicate deliveries gracefully  |
| **Donation Creation**  | Uses idempotencyKey to prevent duplicates    |
| **Retry Safety**       | Operations must be idempotent across retries |
| **Unique Constraints** | Use database constraints for idempotency     |

### 31.2 Transaction Boundaries

| Guideline               | Implementation                             |
| ----------------------- | ------------------------------------------ |
| **Atomic Operations**   | Use transactions for multi-step operations |
| **Rollback on Failure** | Automatic rollback on exceptions           |
| **Outbox Pattern**      | Ensure event delivery even on failures     |

### 31.3 Event Consistency

```typescript
// ✅ CORRECT - Outbox ensures event consistency
async createDonation(dto: CreateDonationDto) {
  const qr = this.dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    // 1. Create donation
    const donation = await qr.manager.save(Donation, dto);

    // 2. Create outbox event (same transaction = atomic)
    await this.outboxService.createEvent('DONATION_CREATED', {...}, qr.manager);

    await qr.commitTransaction();
  } catch (error) {
    await qr.rollbackTransaction();
    throw error;
  }
}
```

### 31.4 Secure File Upload

| Rule                   | Implementation                                |
| ---------------------- | --------------------------------------------- |
| **Type Validation**    | Check MIME type, not just extension           |
| **Size Limits**        | Enforce max file size (10MB)                  |
| **Name Sanitization**  | Generate unique filenames, sanitize originals |
| **Storage Separation** | Store outside web root                        |

### 31.5 Validation-First Architecture

```typescript
// ✅ CORRECT - Validation before business logic
@Post('donations')
async createDonation(@Body() dto: CreateDonationDto) {
  // DTO validation happens BEFORE reaching here (ValidationPipe)
  // Service can assume valid input
  return this.donationsService.create(dto);
}

// DTO ensures validation happens first
class CreateDonationDto {
  @IsArray()
  @ValidateNested({ each: true })
  donationItems: DonationItemDto[];
}
```

---

## 32. Terminology Normalization

This section standardizes terminology across the entire document.

### 32.1 Standard Terms

| Use This                           | Not These                                           |
| ---------------------------------- | --------------------------------------------------- |
| `CollectionResponseDto`            | "PaginatedResponse", "PaginatedDto", "ListResponse" |
| `PaginationQueryDto`               | "PageQuery", "PaginationParams", "ListQuery"        |
| `offset-based pagination`          | "cursor-based pagination" (in pagination context)   |
| `JWT Guard`                        | "AuthGuard", "JwtAuthGuard" (in general docs)       |
| `Role-based access control (RBAC)` | "Authorization", "Access Control"                   |
| `DTO`                              | "Data Transfer Object", "VO", "Data Object"         |
| `QueryBuilder`                     | "query builder", "typeorm query builder"            |

### 32.2 Consistent Naming

| Concept            | Standard Name             |
| ------------------ | ------------------------- |
| Fundraising target | `targetAmount`            |
| Current raised     | `currentAmount`           |
| Donation goal      | `donationGoal`            |
| Unique identifier  | `id` (UUID v4)            |
| Creation timestamp | `createdAt` (ISO8601 UTC) |
| Update timestamp   | `updatedAt` (ISO8601 UTC) |

### 32.3 HTTP Method Usage

| Method   | Use For                      |
| -------- | ---------------------------- |
| `GET`    | Retrieval, listing, reading  |
| `POST`   | Creation, actions (non-CRUD) |
| `PATCH`  | Partial updates              |
| `DELETE` | Removal                      |

---

## 33. Preserve Existing Content

> ⚠️ **IMPORTANT**: This document contains existing route tables, entity definitions, DTOs, and business flows that MUST NOT be removed, shortened, or summarized.

### 33.1 Content That Must Be Preserved

| Section                                | Reason                        |
| -------------------------------------- | ----------------------------- |
| Complete Route Reference (Section 10)  | All 80+ endpoints documented  |
| Complete Entity Reference (Section 11) | All entity fields documented  |
| DTO Reference (Section 12)             | All DTO structures documented |
| Validation Rules Summary               | All validation decorators     |
| Error Handling                         | HTTP status codes             |
| Role-Based Access Matrix               | Complete permission table     |

### 33.2 Enhancement Guidelines

| Action                | Example                          |
| --------------------- | -------------------------------- |
| ADD new sections      | Add section 18+ improvements     |
| EXTEND existing       | Add more detail to entity tables |
| NORMALIZE terminology | Use standard terms throughout    |
| CLARIFY ambiguous     | Add examples where unclear       |
| CORRECT errors        | Fix incorrect documentation      |

### 33.3 What NOT To Do

- ❌ Don't remove route tables
- ❌ Don't summarize entity tables
- ❌ Don't shorten DTO examples
- ❌ Don't consolidate error codes
- ❌ Don't merge role matrices
- ❌ Don't remove business flow descriptions

### 33.4 Final Output Characteristics

The final `SKILLS.md` should function as:

1. **Enterprise Backend Intelligence** - Comprehensive architectural reference
2. **AI-Native Specification** - Optimized for AI agent consumption
3. **Long-Term Maintainable** - Clear structure for updates
4. **Machine-Readable** - Deterministic, unambiguous
5. **Route-Stable** - Existing routes preserved
6. **Future-Ready** - Clear separation of planned vs implemented

---

_End of SKILLS.md - Enterprise Backend Intelligence Document_
