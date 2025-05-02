# NestJS Backend with Supabase Authentication

This is a NestJS backend application that uses Supabase for authentication and PostgreSQL with TypeORM for data management.

## Features

- User authentication with Supabase
- JWT-based session management
- Role-based access control
- Admin dashboard with user management
- Secure database interactions with TypeORM
- Environment-based configuration

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- Supabase account and project

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd <project-directory>
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=your_database
JWT_SECRET=your_jwt_secret_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
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
- POST /admin/users/:id/role - Update user role (admin only)
- DELETE /admin/users/:id - Delete user (admin only)

## Security Features

- JWT-based authentication
- Role-based access control
- Request validation
- Data encryption
- Secure password handling
- Protected admin routes

## Project Structure

```
src/
├── auth/                 # Authentication module
├── admin/               # Admin module
├── config/              # Configuration
├── entities/            # TypeORM entities
├── guards/              # Authentication guards
├── interceptors/        # Response interceptors
├── middlewares/         # Request middlewares
└── supabase/            # Supabase service
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request
