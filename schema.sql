-- ════════════════════════════════════════════
--  Hotel SaaS Platform — PostgreSQL Schema
--  Run this file ONCE in pgAdmin Query Tool
--  or via: psql -d hotel_saas_db -f schema.sql
-- ════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
--  ENUMS
-- ─────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'OWNER', 'EMPLOYEE');
CREATE TYPE org_status AS ENUM ('Active', 'Inactive', 'Suspended');
CREATE TYPE room_status AS ENUM ('Available', 'Occupied', 'Maintenance');
CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');
CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'FAILED');
CREATE TYPE payment_method AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'UPI', 'OTHER');

-- ─────────────────────────────────────────────
--  1. ORGANIZATIONS (Tenants)
-- ─────────────────────────────────────────────
CREATE TABLE organizations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  code          VARCHAR(10) UNIQUE,
  logo_url      TEXT,
  banner_images TEXT[] DEFAULT '{}',
  website       VARCHAR(255),
  phone         VARCHAR(50),
  address       TEXT,
  status        org_status NOT NULL DEFAULT 'Active',
  plan          VARCHAR(50) DEFAULT 'Professional',
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─────────────────────────────────────────────
--  2. USERS (Super Admin, Owner, Employee)
-- ─────────────────────────────────────────────
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255) NOT NULL,
  email             VARCHAR(255) UNIQUE NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,
  role              user_role NOT NULL DEFAULT 'EMPLOYEE',
  organization_id   UUID REFERENCES organizations(id) ON DELETE SET NULL,
  status            VARCHAR(50) DEFAULT 'Active',
  last_active       TIMESTAMP WITH TIME ZONE,
  refresh_token     TEXT,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_org ON users(organization_id);

-- ─────────────────────────────────────────────
--  3. HOTELS (Belong to Organization)
-- ─────────────────────────────────────────────
CREATE TABLE hotels (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  city              VARCHAR(100),
  state             VARCHAR(100),
  location          VARCHAR(255),
  description       TEXT,
  phone             VARCHAR(50),
  email             VARCHAR(255),
  address           TEXT,
  image_urls        TEXT[] DEFAULT '{}',
  rating            NUMERIC(3,1) DEFAULT 5.0,
  status            VARCHAR(50) DEFAULT 'Active',
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_hotels_org ON hotels(organization_id);

-- ─────────────────────────────────────────────
--  4. ROOMS (Belong to Hotel)
-- ─────────────────────────────────────────────
CREATE TABLE rooms (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id        UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  room_number     VARCHAR(20) NOT NULL,
  type            VARCHAR(100) DEFAULT 'Standard',
  price           NUMERIC(10,2) NOT NULL,
  floor           VARCHAR(20),
  max_guests      INTEGER NOT NULL DEFAULT 2,
  adults          INTEGER NOT NULL DEFAULT 2,
  children        INTEGER NOT NULL DEFAULT 0,
  amenities       TEXT[] DEFAULT '{}',
  image_urls      TEXT[] DEFAULT '{}',
  status          room_status NOT NULL DEFAULT 'Available',
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (hotel_id, room_number)
);

CREATE INDEX idx_rooms_hotel ON rooms(hotel_id);
CREATE INDEX idx_rooms_status ON rooms(status);

-- ─────────────────────────────────────────────
--  5. CUSTOMERS (Global — not tied to any org)
-- ─────────────────────────────────────────────
CREATE TABLE customers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  phone       VARCHAR(50),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_customers_email ON customers(email);

-- ─────────────────────────────────────────────
--  6. BOOKINGS
-- ─────────────────────────────────────────────
CREATE TABLE bookings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  check_in        DATE NOT NULL,
  check_out       DATE NOT NULL,
  status          booking_status NOT NULL DEFAULT 'PENDING',
  total_price     NUMERIC(10,2) NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_dates CHECK (check_out > check_in)
);

CREATE INDEX idx_bookings_room ON bookings(room_id);
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_org ON bookings(organization_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_dates ON bookings(check_in, check_out);

-- ─────────────────────────────────────────────
--  7. PAYMENTS
-- ─────────────────────────────────────────────
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id      UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  amount          NUMERIC(10,2) NOT NULL,
  status          payment_status NOT NULL DEFAULT 'PENDING',
  method          payment_method DEFAULT 'CASH',
  transaction_ref VARCHAR(255),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_org ON payments(organization_id);

-- ─────────────────────────────────────────────
--  AUTO UPDATE updated_at via trigger
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hotels_updated_at BEFORE UPDATE ON hotels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────
--  SEED: Default Super Admin
--  Password: admin123 (bcrypt hash — change in production!)
-- ─────────────────────────────────────────────
INSERT INTO users (name, email, password_hash, role, organization_id)
VALUES (
  'Platform Admin',
  'admin@saas.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewqVaMH5fGByHsLe',
  'SUPER_ADMIN',
  NULL
);
-- Default password is: admin123
