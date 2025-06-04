# NestJS Backend with passport Authentication

This is a NestJS backend application that uses passport for authentication and PostgreSQL with TypeORM for data management.

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
- PostgreSQL database

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
# App Port
APP=3000
# Database
TYPE=postgres
HOST=localhost
PORT_DATABASE=5432
USER=postgres
PASSWORD=root
DB=mbrat-rashaidah
# JWT Access Token
JWT_ACCESS_SECRET=your_supabase_jwt_secret
JWT_EXPIRATION=1h
# JWT Access Token
JWT_REFRESH_SECRET=my_refresh_token_secret_456
JWT_REFRESH_EXPIRATION=1d
# OTP
OTP_ENABLED=false
EXP_MINUTES=2
# Mail
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_SECURE=SSL
MAIL_USER=studentofthecourse@gmail.com
MAIL_PASS=jadsbajbdadasd
MAIL_FROM=studentofthecourse@gmail.com
MAIL_FROM_NAME=No‑Reply
# Payment
# Stripe
STRIPE_SECRET_KEY=nsjsdjabsdjab
STRIPE_WEBHOOK_SECRET=nsjsdjabsdjab
# Myfatoora
MYFATOORA_API_KEY=aqweqe
MYFATOORA_API_URL=saaasa
MYFATOORA_CALLBACK_URL=saaasa
MYFATOORA_ERROR_URL=lnjbjkbkj
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

## User & Authentication

- `POST /auth/register` — Register a new user
- `POST /auth/login` — User login
- `POST /auth/otp-verify` — Verify OTP code
- `POST /auth/refresh` — Refresh access token
- `GET /auth/profile` — Get logged-in user's profile

## User Management

- `POST /users` — Create a user
- `GET /users` — Get all users
- `GET /users/:id` — Get user by ID
- `PUT /users/:id` — Update user
- `DELETE /users/:id` — Delete user

## Admin Management

- `GET /admin/users` — Get all users (admin only)
- `GET /admin/users/:id` — Get specific user
- `POST /admin/users/:id/role` — Update user role (super_admin only)
- `DELETE /admin/users/:id` — Delete user

## Project Management

- `POST /projects` — Create a project
- `GET /projects` — Get all projects
- `GET /projects/:id` — Get project by ID
- `PATCH /projects/:id` — Update project
- `DELETE /projects/:id` — Delete project
- `GET /projects/category/:categoryId` — Filter by category
- `GET /projects/country/:countryId` — Filter by country
- `GET /projects/status/:status` — Filter by status
- `GET /projects/details/:projectId` — Get project details
- `GET /projects/stats/summary` — Get project summary stats

## Campaigns

- `GET /campaigns` — List all campaigns
- `POST /campaigns` — Create a campaign
- `GET /campaigns/:id` — Get campaign by ID
- `PUT /campaigns/:id` — Update campaign
- `DELETE /campaigns/:id` — Delete campaign

## Donations

- `GET /donations/project/:projectId` — Get donations for a project
- `POST /donations/project/:projectId` — Make a donation to a project
- `GET /donations/:id` — Get donation by ID
- `DELETE /donations/:id` — Delete donation
- `POST /donations/webhook/stripe` — Stripe webhook
- `POST /donations/webhook/myfatoora` — MyFatoora webhook

## Payment Integrations

### Stripe

- `POST /stripe/webhook`
- `GET /stripe/payment/:id`
- `GET /stripe/success/:donationId`
- `GET /stripe/cancel/:donationId`

### MyFatoora

- `POST /myfatoora/webhook`
- `GET /myfatoora/payment/:id`
- `GET /myfatoora/success/:donationId`
- `GET /myfatoora/cancel/:donationId`

## Countries & Continents

### Countries

- `POST /countries`
- `GET /countries`
- `GET /countries/:id`
- `PUT /countries/:id`
- `DELETE /countries/:id`

### Continents

- `POST /continents`
- `GET /continents`
- `GET /continents/:id`
- `PUT /continents/:id`
- `DELETE /continents/:id`

## Categories

- `POST /categories`
- `GET /categories`
- `GET /categories/:id`
- `GET /categories/slug/:slug`
- `PATCH /categories/:id`
- `DELETE /categories/:id`

## Banners

- `POST /banners`
- `GET /banners`
- `GET /banners/:id`
- `PATCH /banners/:id`
- `DELETE /banners/:id`

## Media

- `POST /media/upload`
- `GET /media`
- `GET /media/:id`
- `GET /media/:id/data`
- `PATCH /media/:id`
- `DELETE /media/:id`

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
    └── app.module.ts
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
