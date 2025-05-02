# NestJS Backend with passport Authentication

This is a NestJS backend application that uses passport for authentication and PostgreSQL with TypeORM for data management.

## Features

- User authentication with passport
- JWT-based session management
- Role-based access control
- Admin dashboard with user management
- Secure database interactions with TypeORM
- Environment-based configuration

## Prerequisites

- Node.js (v14 or higher)
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
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=root
POSTGRES_DB=mbrat-rashaidah
# JWT access token
JWT_ACCESS_SECRET=your_jwt_secret
JWT_EXPIRATION=1h
# JWT access token
JWT_REFRESH_SECRET=my_refresh_token_secret_456
JWT_REFRESH_EXPIRATION=1d
# OTP
OTP_ENABLED=false
# Mail
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_SECURE=SSL
MAIL_USER=studentofthecourse@gmail.com
MAIL_PASS=yhhgiggfgfggfgfg
MAIL_FROM=studentofthecourse@gmail.com
MAIL_FROM_NAME=No‑Reply
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

### Authentication

- POST /auth/login - User login
- GET /auth/profile - Get user profile (protected)

### Admin

- GET /admin/users - List all users (admin only)
- GET /admin/users/:id - Get user details (admin only)
- POST /admin/users/:id/role - Update user role (super_admin only)
- DELETE /admin/users/:id - Delete user (super_admin only)

## Security Features

- JWT-based authentication
- Role-based access control
- Request validation
- Data encryption
- Secure password handling
- Protected admin routes

## Project Structure

```

```
