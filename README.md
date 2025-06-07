# NestJS Backend with passport Authentication

This is a NestJS backend application that uses passport for authentication and MySQL with TypeORM for data management.

## Features

- User authentication with passport
- JWT-based session management
- Role-based access control
- Admin dashboard with user management
- Secure database interactions with TypeORM
- Environment-based configuration

## 📦 Platform Features

- ✅ **User & Account Management**

  - User registration and login
  - OTP verification for added security
  - Token refresh and JWT session handling
  - Admin dashboard with role and access control

- 🏗️ **Charity Project Management**

  - Create, update, and delete projects
  - Filter by category, country, or status
  - View detailed project information and statistics

- 🎯 **Campaigns Module**

  - Launch and manage fundraising campaigns
  - Link campaigns to specific projects
  - Full CRUD support for campaigns

- 💸 **Donations System**

  - Donate directly to specific projects
  - View and manage individual donations
  - Integration with **Stripe** and **MyFatoora** for secure payments
  - Webhook support for real-time payment updates

- 🌍 **Geographical Classification**

  - Manage countries and continents
  - Assign projects to specific regions

- 🧭 **Categories Management**

  - Define and manage categories for projects
  - Support for slug-based lookup and filtering

- 📢 **Banner & Promotion System**

  - Manage promotional banners across the platform
  - Upload media and assign to banners

- 🖼️ **Media Library**

  - Upload and manage images and media files
  - View raw media data and metadata

- ✉️ **Email Integration**

  - Send verification or notification emails
  - SMTP configuration via environment variables

- 🛡️ **Security & Access Control**

  - JWT-based authentication
  - Role-based permissions (user, admin, super_admin)
  - Request validation and password encryption
  - Protected admin routes

## Prerequisites

- Node.js (v20.18.0 or higher)
- MySQL database

## Installation

1. Clone the repository:

```bash
git clone https://github.com/globalgrayhat/mbrat-rashaidah-backend.git
cd mbrat-rashaidah-backend
```

2. Install dependencies:

```bash
npm i
```

3. Create a `.env` file in the root directory with the following variables:

```env
# App Config
APP_NAME=mbrat-rashaidah-backend
PORT=3003
ALLOWED_ORIGINS=https://localhost,https://admin.localhost
BASE_DOMAIN=localhost
API_DOMAIN=localhost
# Environment
NODE_ENV=development
# Database
TYPE_DATABASE=mysql
HOST_DATABASE=localhost
PORT_DATABASE=3306
USER_DATABASE=root
PASSWORD_DATABASE=
NAME_DATABASE=mbrat_rashaidah
# JWT Access Token
JWT_ACCESS_SECRET=your_supabase_jwt_secret
JWT_EXPIRATION=30m
# JWT Refresh Token
JWT_REFRESH_SECRET=my_refresh_token_secret_456
JWT_REFRESH_EXPIRATION=2h
# OTP
OTP_ENABLED=false
EXP_MINUTES=2
OTP_LENGTH=6
# Mail
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_SECURE=SSL
MAIL_USER=studentofthecourse@gmail.com
MAIL_PASS=sdfsfssfgfssvsavvrv
MAIL_FROM=studentofthecourse@gmail.com
MAIL_FROM_NAME=No‑Reply
# Payment
# Stripe
STRIPE_SECRET_KEY=nsjsdjabsdjab
STRIPE_WEBHOOK_SECRET=nsjsdjabsdjab
# Myfatoora
MYFATOORA_BASE_URL=https://api.myfatoorah.com
MYFATOORA_API_KEY=your_api_key_here
MYFATOORA_SUCCESS_URL=https://yourapp.com/payments/myfatoora/success
MYFATOORA_ERROR_URL=https://yourapp.com/payments/myfatoora/cancel
MYFATOORA_WEBHOOK_SECRET=optional_webhook_secret
```

4. Set up the database:

```bash
npm run typeorm migration:run
```

## Running the Application

Development mode:

```bash
npm run start:dev
```

Production mode:

```bash
npm run build
npm run start:prod
```

## API Endpoints

### User & Authentication

| Method | Path               | Description              |
| ------ | ------------------ | ------------------------ |
| POST   | `/auth/register`   | Register a new user      |
| POST   | `/auth/login`      | Log in and receive JWT   |
| POST   | `/auth/otp-verify` | Verify OTP code          |
| POST   | `/auth/refresh`    | Refresh JWT token        |
| GET    | `/auth/profile`    | Get current user profile |

### Users

| Method | Path         | Description       |
| ------ | ------------ | ----------------- |
| POST   | `/users`     | Create a new user |
| GET    | `/users`     | List all users    |
| GET    | `/users/:id` | Get user by ID    |
| PUT    | `/users/:id` | Update user by ID |
| DELETE | `/users/:id` | Delete user by ID |

### Admin (Role Management)

| Method | Path                    | Description                   |
| ------ | ----------------------- | ----------------------------- |
| GET    | `/admin/users`          | List all users (admin only)   |
| GET    | `/admin/users/:id`      | Get user by ID (admin only)   |
| POST   | `/admin/users/:id/role` | Change user role (admin only) |
| DELETE | `/admin/users/:id`      | Delete user (admin only)      |

### Banners

| Method | Path           | Description         |
| ------ | -------------- | ------------------- |
| POST   | `/banners`     | Create a banner     |
| GET    | `/banners`     | List all banners    |
| GET    | `/banners/:id` | Get banner by ID    |
| PATCH  | `/banners/:id` | Update banner by ID |
| DELETE | `/banners/:id` | Delete banner by ID |

### Projects

| Method | Path                             | Description                    |
| ------ | -------------------------------- | ------------------------------ |
| POST   | `/projects`                      | Create a new project           |
| GET    | `/projects`                      | List all projects              |
| GET    | `/projects/:id`                  | Get project by ID              |
| PATCH  | `/projects/:id`                  | Update project by ID           |
| DELETE | `/projects/:id`                  | Delete project by ID           |
| GET    | `/projects/category/:categoryId` | List projects by category      |
| GET    | `/projects/country/:countryId`   | List projects by country       |
| GET    | `/projects/status/:status`       | List projects by status        |
| GET    | `/projects/details/:projectId`   | Get project details with stats |
| GET    | `/projects/stats/summary`        | Get summary statistics         |

### Categories

| Method | Path                     | Description           |
| ------ | ------------------------ | --------------------- |
| POST   | `/categories`            | Create a new category |
| GET    | `/categories`            | List all categories   |
| GET    | `/categories/:id`        | Get category by ID    |
| GET    | `/categories/slug/:slug` | Get category by slug  |
| PATCH  | `/categories/:id`        | Update category by ID |
| DELETE | `/categories/:id`        | Delete category by ID |

### Countries

| Method | Path             | Description          |
| ------ | ---------------- | -------------------- |
| POST   | `/countries`     | Create a new country |
| GET    | `/countries`     | List all countries   |
| GET    | `/countries/:id` | Get country by ID    |
| PUT    | `/countries/:id` | Update country by ID |
| DELETE | `/countries/:id` | Delete country by ID |

### Continents

| Method | Path              | Description            |
| ------ | ----------------- | ---------------------- |
| POST   | `/continents`     | Create a new continent |
| GET    | `/continents`     | List all continents    |
| GET    | `/continents/:id` | Get continent by ID    |
| PUT    | `/continents/:id` | Update continent by ID |
| DELETE | `/continents/:id` | Delete continent by ID |

### Media

| Method | Path              | Description                |
| ------ | ----------------- | -------------------------- |
| POST   | `/media/upload`   | Upload a media file        |
| GET    | `/media`          | List all media             |
| GET    | `/media/:id`      | Get media metadata by ID   |
| GET    | `/media/:id/data` | Download media binary data |
| PATCH  | `/media/:id`      | Update media metadata      |
| DELETE | `/media/:id`      | Delete media by ID         |

### Campaigns

| Method | Path             | Description           |
| ------ | ---------------- | --------------------- |
| GET    | `/campaigns`     | List all campaigns    |
| POST   | `/campaigns`     | Create a new campaign |
| GET    | `/campaigns/:id` | Get campaign by ID    |
| PUT    | `/campaigns/:id` | Update campaign by ID |
| DELETE | `/campaigns/:id` | Delete campaign by ID |

### Donations

| Method | Path                            | Description                     |
| ------ | ------------------------------- | ------------------------------- |
| GET    | `/donations/project/:projectId` | List donations for a project    |
| POST   | `/donations/project/:projectId` | Create a donation for a project |
| GET    | `/donations/:id`                | Get a donation by ID            |
| DELETE | `/donations/:id`                | Delete a donation by ID         |
| POST   | `/donations/webhook/stripe`     | Stripe webhook handling         |
| POST   | `/donations/webhook/myfatoora`  | MyFatoora webhook handling      |

### Stripe Gateway

| Method | Path                          | Description                           |
| ------ | ----------------------------- | ------------------------------------- |
| POST   | `/stripe/webhook`             | Stripe webhook endpoint               |
| GET    | `/stripe/status/:id`          | Check Stripe payment status           |
| GET    | `/stripe/success/:donationId` | Redirect on successful Stripe payment |
| GET    | `/stripe/cancel/:donationId`  | Redirect on canceled Stripe payment   |

### MyFatoora Gateway

| Method | Path                             | Description                              |
| ------ | -------------------------------- | ---------------------------------------- |
| POST   | `/myfatoora/webhook`             | MyFatoora webhook endpoint               |
| GET    | `/myfatoora/status/:id`          | Check MyFatoora payment status           |
| GET    | `/myfatoora/success/:donationId` | Redirect on successful MyFatoora payment |
| GET    | `/myfatoora/cancel/:donationId`  | Redirect on canceled MyFatoora payment   |

## Security Features

- JWT-based authentication
- Role-based access control
- Request validation
- Data encryption
- Secure password handling
- Protected admin routes

## Project Structure

```
└── 📁src
    └── 📁admin
        └── admin.controller.ts
        └── admin.module.ts
        └── admin.service.ts
    └── 📁auth
        └── auth.controller.ts
        └── auth.module.ts
        └── auth.service.ts
        └── 📁dto
            └── login.dto.ts
            └── otp-verify.dto.ts
            └── register.dto.ts
    └── 📁banners
        └── banners.controller.ts
        └── banners.module.ts
        └── banners.service.ts
        └── 📁dto
            └── create-banner.dto.ts
            └── update-banner.dto.ts
        └── 📁entities
            └── banner.entity.ts
    └── 📁campaigns
        └── campaigns.controller.ts
        └── campaigns.module.ts
        └── campaigns.service.ts
        └── 📁dto
            └── createCampaignDto.ts
            └── UpdateCampaignDto.ts
        └── 📁entities
            └── campaign.entity.ts
    └── 📁categories
        └── categories.controller.ts
        └── categories.module.ts
        └── categories.service.ts
        └── 📁dto
            └── create-category.dto.ts
            └── update-category.dto.ts
        └── 📁entities
            └── category.entity.ts
    └── 📁common
        └── 📁configs
            └── media.config.ts
        └── 📁constants
            └── campaignPurpose.constant.ts
            └── campaignStatus.constant.ts
            └── donationStatus.constant.ts
            └── media.constant.ts
            └── payment.constant.ts
            └── project.constant.ts
            └── roles.constant.ts
            └── t.constant.ts
        └── 📁decorators
            └── public.decorator.ts
            └── roles.decorator.ts
        └── 📁guards
            └── jwt-auth.guard.ts
            └── roles.guard.ts
        └── 📁interceptors
            └── traffic.interceptor.ts
        └── 📁interfaces
            └── jwt-payload.interface.ts
            └── myfatoora.interface.ts
            └── payment-service.interface.ts
            └── payment.interface.ts
        └── 📁mail
            └── mail.module.ts
            └── mail.service.ts
        └── 📁otp
            └── otp.module.ts
            └── otp.service.ts
        └── 📁pipes
            └── campaignExists.pipe.ts
            └── donationExists.pipe.ts
            └── file-size.pipe.ts
            └── file-type.pipe.ts
        └── 📁services
            └── logger.service.ts
            └── monitoring.service.ts
        └── 📁strategies
            └── jwt.strategy.ts
            └── refresh-token.strategy.ts
        └── 📁utils
            └── otp-generator.util.ts
        └── 📁validators
            └── mime-types.validator.ts
    └── 📁config
        └── config.module.ts
        └── config.service.ts
    └── 📁continents
        └── continents.controller.ts
        └── continents.module.ts
        └── continents.service.ts
        └── 📁dto
            └── create-continent.dto.ts
            └── update-continent.dto.ts
        └── 📁entities
            └── continent.entity.ts
    └── 📁countries
        └── countries.controller.ts
        └── countries.module.ts
        └── countries.service.ts
        └── 📁dto
            └── create-country.dto.ts
            └── update-country.dto.ts
        └── 📁entities
            └── country.entity.ts
    └── 📁donations
        └── donations.controller.ts
        └── donations.module.ts
        └── donations.service.ts
        └── 📁dto
            └── create-donation.dto.ts
            └── update-donation.dto.ts
        └── 📁entities
            └── donation.entity.ts
    └── 📁media
        └── 📁dto
            └── create-media.dto.ts
            └── update-media.dto.ts
        └── 📁entities
            └── media.entity.ts
        └── media.controller.ts
        └── media.module.ts
        └── media.service.ts
    └── 📁myfatoora
        └── myfatoora.controller.ts
        └── myfatoora.module.ts
        └── myfatoora.service.ts
    └── 📁projects
        └── 📁dto
            └── create-project.dto.ts
            └── update-project.dto.ts
        └── 📁entities
            └── project.entity.ts
        └── projects.controller.ts
        └── projects.module.ts
        └── projects.service.ts
    └── 📁stripe
        └── stripe.controller.ts
        └── stripe.module.ts
        └── stripe.service.ts
    └── 📁user
        └── 📁dto
            └── create-user.dto.ts
            └── update-user.dto.ts
        └── 📁entities
            └── user.entity.ts
        └── user.controller.ts
        └── user.module.ts
        └── user.service.ts
    └── app.controller.ts
    └── app.module.ts
    └── app.service.ts
    └── main.ts
```

## 👤 Author

Developed by **Ali Dirawi** – a passionate developer focused on **safety**, **AI**, and **embedded systems**.

> ## 👤 Author Info
>
> **Ali Dirawi** — 🇮🇶 _Iraq_
> 🧠 _Cybersecurity & AI Researcher_
> 📬 [@AliDirawi on Telegram](https://t.me/deskram)
>
> © 2025 The Global Gray Hat Group — All rights reserved.
