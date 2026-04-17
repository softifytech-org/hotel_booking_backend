# Hotel SaaS Backend

A production-grade, multi-tenant Hotel Management System backend built with Node.js, Express, and PostgreSQL (Supabase).

## Features

- **Multi-Tenancy**: Support for multiple organizations with isolated data.
- **Role-Based Access Control (RBAC)**: Distinct permissions for `SUPER_ADMIN`, `OWNER`, and `EMPLOYEE`.
- **Organization Management**: Auto-generation of unique 3-character organization codes (e.g., `A1B`).
- **Hotel & Room Management**: Create and manage hotels, rooms, and availability.
- **Booking Engine**: Overlap-prevention logic for room bookings.
- **Guest Demographics**: Track adults, children, and specific children ages per booking.
- **Payment Tracking**: Record and manage payments linked to bookings.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (Supabase)
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Strict regex-based validation for organization codes.

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL Database

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/softifytech-org/Hotel_booking_apis.git
   cd Hotel_booking_apis
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (Create a `.env` file):
   ```env
   PORT=5000
   DATABASE_URL=your_postgresql_url
   JWT_SECRET=your_jwt_secret
   ```

4. Start the server:
   ```bash
   npm start
   ```

## API Documentation

For a full list of endpoints and request/response payloads, refer to the `openapi.yaml` file included in the repository.

### Key Endpoints

- `POST /api/auth/login`: Authenticate users.
- `POST /api/organizations`: Create new organizations (Super Admin only).
- `POST /api/hotels`: Create hotels.
- `POST /api/rooms`: Create rooms.
- `POST /api/bookings`: Manage reservations.

## License

MIT
