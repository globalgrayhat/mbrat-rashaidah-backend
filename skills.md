# MBRAT Rashaidah API Collection

This document contains a comprehensive list of the standardized API routes implemented in the MBRAT Rashaidah backend. All endpoints follow a unified pagination and response structure.

## Authentication
- `POST /api/auth/register`: Register a new user.
- `POST /api/auth/login`: Login and receive JWT tokens.
- `POST /api/auth/otp-verify`: Verify registration/login OTP.
- `POST /api/auth/refresh`: Refresh access token using refresh token.
- `GET /api/auth/profile`: Get current user profile (Requires JWT).

## Admin Management
- `GET /api/admin/users`: List all users with pagination (Requires Admin).
- `GET /api/admin/users/:id`: Get user details.
- `POST /api/admin/users/:id/role`: Update user role (Requires Super Admin).
- `DELETE /api/admin/users/:id`: Delete user (Requires Super Admin).

## Projects
- `GET /api/projects`: List all projects (Public, Paginated).
- `GET /api/projects/:id`: Get project details (ID or Slug).
- `POST /api/projects`: Create project (Admin).
- `PATCH /api/projects/:id`: Update project (Admin).
- `DELETE /api/projects/:id`: Delete project (Admin).
- `PATCH /api/projects/reorder-pins`: Reorder pinned projects.

## Campaigns
- `GET /api/campaigns`: List all campaigns (Public, Paginated).
- `GET /api/campaigns/:id`: Get campaign details (ID or Slug).
- `POST /api/campaigns`: Create campaign (Admin).
- `PATCH /api/campaigns/:id`: Update campaign (Admin).
- `DELETE /api/campaigns/:id`: Delete campaign (Admin).
- `PATCH /api/campaigns/reorder-pins`: Reorder pinned campaigns.

## Banners
- `GET /api/banners`: List all banners (Public, Paginated).
- `POST /api/banners`: Create banner (Admin).
- `PATCH /api/banners/:id`: Update banner (Admin).
- `DELETE /api/banners/:id`: Delete banner (Admin).
- `PATCH /api/banners/reorder-pins`: Reorder pinned banners.

## Donations & Payments
- `GET /api/donations`: List all donations (Admin, Paginated).
- `POST /api/donations`: Create a donation (Internal/External).
- `GET /api/donations/payment-status/invoice/:invoiceId`: Reconcile payment by invoice.
- `GET /api/donations/payment-status/payment/:paymentId`: Reconcile payment by payment ID.
- `POST /api/donations/payment/webhook`: MyFatoorah webhook handler.

## Donors
- `GET /api/donors`: List all donors (Admin, Paginated).
- `GET /api/donors/:id`: Get donor details.

## Categories, Countries & Continents
- `GET /api/categories`: List categories (Paginated).
- `GET /api/countries`: List countries (Paginated).
- `GET /api/continents`: List continents (Paginated).

## Media
- `POST /api/media/upload`: Upload a file (Admin).
- `GET /api/media`: List all media items (Paginated).
- `GET /api/media/:id/data`: Stream file data.
- `POST /api/media/fix-encoding`: Fix Arabic encoding issues (Super Admin).

---
*Note: All paginated endpoints support `page`, `limit`, `sortBy`, `sortOrder`, and `search` query parameters.*
