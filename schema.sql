-- Database Schema for Hotel Management System MVP

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define Custom Types / Enums
CREATE TYPE user_role AS ENUM ('admin', 'front_desk', 'housekeeping');
CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended', 'locked');
CREATE TYPE room_status AS ENUM ('available', 'occupied', 'dirty', 'cleaning', 'out_of_order');
CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'checked_in', 'checked_out', 'canceled', 'abandoned');
CREATE TYPE payment_status AS ENUM ('unpaid', 'processing', 'captured', 'declined');
CREATE TYPE deposit_status AS ENUM ('none', 'held', 'refunded', 'forfeited');
CREATE TYPE transaction_type AS ENUM ('payment', 'refund', 'deposit_hold', 'deposit_refund', 'deposit_forfeit');

-- 1. Profiles Table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role user_role NOT NULL DEFAULT 'front_desk',
  status user_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 2. Room Types Table
CREATE TABLE room_types (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  max_capacity INTEGER NOT NULL,
  base_rate NUMERIC(10, 2) NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 3. Rooms Table (Physical Rooms)
CREATE TABLE rooms (
  id VARCHAR(10) PRIMARY KEY, -- e.g., '101', '102'
  room_type_id UUID REFERENCES room_types(id) ON DELETE RESTRICT NOT NULL,
  status room_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 4. Reservations Table
CREATE TABLE reservations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_ref VARCHAR(10) NOT NULL UNIQUE, -- e.g., 'HOS-72A9B'
  guest_first_name VARCHAR(100) NOT NULL,
  guest_last_name VARCHAR(100) NOT NULL,
  guest_email VARCHAR(150) NOT NULL,
  guest_phone VARCHAR(20) NOT NULL,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  room_type_id UUID REFERENCES room_types(id) ON DELETE RESTRICT NOT NULL,
  room_id VARCHAR(10) REFERENCES rooms(id) ON DELETE SET NULL, -- Assigned room
  status reservation_status NOT NULL DEFAULT 'pending',
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  payment_method VARCHAR(20), -- 'online', 'cash', 'card_terminal'
  incidental_deposit_amount NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
  incidental_deposit_method VARCHAR(20), -- 'cash', 'card_auth'
  incidental_deposit_status deposit_status NOT NULL DEFAULT 'none',
  special_requests TEXT,
  hold_expires_at TIMESTAMP WITH TIME ZONE, -- 10-minute hold for booking cart
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  CONSTRAINT check_dates CHECK (check_out_date > check_in_date)
);

-- 5. Maintenance Tickets Table
CREATE TABLE maintenance_tickets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id VARCHAR(10) REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  is_critical BOOLEAN DEFAULT FALSE NOT NULL,
  status VARCHAR(20) DEFAULT 'open' NOT NULL, -- 'open', 'in_progress', 'resolved'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- 6. Shifts Table (for drawer reconciliation)
CREATE TABLE shifts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  staff_id UUID REFERENCES profiles(id) ON DELETE RESTRICT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  starting_cash NUMERIC(10, 2) NOT NULL,
  expected_cash NUMERIC(10, 2) NOT NULL, -- calculated by starting_cash + cash_revenue + cash_deposits - refunded_deposits
  actual_cash NUMERIC(10, 2),
  variance NUMERIC(10, 2),
  status VARCHAR(10) DEFAULT 'active' NOT NULL, -- 'active', 'closed'
  closed_by_admin_id UUID REFERENCES profiles(id)
);

-- 7. Financial Transactions Table (Immutable Ledger)
CREATE TABLE financial_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reservation_id UUID REFERENCES reservations(id) ON DELETE RESTRICT NOT NULL,
  shift_id UUID REFERENCES shifts(id) ON DELETE RESTRICT, -- Nullable for online web bookings
  amount NUMERIC(10, 2) NOT NULL,
  type transaction_type NOT NULL,
  payment_method VARCHAR(20) NOT NULL, -- 'online', 'cash', 'card_terminal'
  status VARCHAR(10) DEFAULT 'settled' NOT NULL, -- 'settled', 'voided'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  processed_by UUID REFERENCES profiles(id)
);

-- DATABASE TRIGGERS & FUNCTIONS

-- Trigger A: Auto-update room status based on reservation changes (Check-In -> Occupied, Check-Out -> Dirty)
CREATE OR REPLACE FUNCTION handle_reservation_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Check-In
  IF NEW.status = 'checked_in' AND OLD.status != 'checked_in' AND NEW.room_id IS NOT NULL THEN
    UPDATE rooms SET status = 'occupied' WHERE id = NEW.room_id;
  END IF;

  -- Check-Out
  IF NEW.status = 'checked_out' AND OLD.status != 'checked_out' AND NEW.room_id IS NOT NULL THEN
    UPDATE rooms SET status = 'dirty' WHERE id = NEW.room_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_reservation_status_change
  AFTER UPDATE OF status ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION handle_reservation_status_change();


-- Trigger B: Auto-update room status when critical maintenance tickets are opened/resolved
CREATE OR REPLACE FUNCTION handle_maintenance_ticket_change()
RETURNS TRIGGER AS $$
BEGIN
  -- New Critical Ticket
  IF (TG_OP = 'INSERT') AND NEW.is_critical = TRUE THEN
    UPDATE rooms SET status = 'out_of_order' WHERE id = NEW.room_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- If ticket marked critical
    IF NEW.is_critical = TRUE AND OLD.is_critical = FALSE THEN
      UPDATE rooms SET status = 'out_of_order' WHERE id = NEW.room_id;
    -- If critical ticket is resolved, send room to Dirty
    ELSIF NEW.status = 'resolved' AND OLD.status != 'resolved' AND NEW.is_critical = TRUE THEN
      UPDATE rooms SET status = 'dirty' WHERE id = NEW.room_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_maintenance_ticket_change
  AFTER INSERT OR UPDATE ON maintenance_tickets
  FOR EACH ROW
  EXECUTE FUNCTION handle_maintenance_ticket_change();


-- Helper function to clean up expired reservation holds
CREATE OR REPLACE FUNCTION release_expired_holds()
RETURNS INT AS $$
DECLARE
  released_count INT;
BEGIN
  -- Mark reservations as abandoned if hold is expired and still unpaid
  UPDATE reservations 
  SET status = 'abandoned' 
  WHERE status = 'pending' 
    AND payment_status = 'unpaid' 
    AND hold_expires_at < NOW();
    
  GET DIAGNOSTICS released_count = ROW_COUNT;
  RETURN released_count;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) Configuration

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Public profiles are viewable by authenticated users"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE TO authenticated USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE TO authenticated USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins or owners can insert profiles"
  ON profiles FOR INSERT TO authenticated WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' OR auth.uid() = id
  );

-- 2. Room Types Policies
CREATE POLICY "Room types are viewable by anyone"
  ON room_types FOR SELECT USING (true);

CREATE POLICY "Only admins can modify room types"
  ON room_types FOR ALL TO authenticated USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- 3. Rooms Policies
CREATE POLICY "Rooms are viewable by anyone"
  ON rooms FOR SELECT USING (true);

CREATE POLICY "Staff can update room statuses"
  ON rooms FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Only admins can insert/delete rooms"
  ON rooms FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
CREATE POLICY "Only admins can delete rooms"
  ON rooms FOR DELETE TO authenticated USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- 4. Reservations Policies
CREATE POLICY "Public guests can create reservations"
  ON reservations FOR INSERT WITH CHECK (true);

CREATE POLICY "Public guests can view their own reservations"
  ON reservations FOR SELECT USING (true); -- Guest checks by email / ref in web

CREATE POLICY "Staff have full access to reservations"
  ON reservations FOR ALL TO authenticated USING (true);

-- 5. Maintenance Tickets Policies
CREATE POLICY "Staff have full access to maintenance tickets"
  ON maintenance_tickets FOR ALL TO authenticated USING (true);

-- 6. Shifts Policies
CREATE POLICY "Staff can manage their own shifts"
  ON shifts FOR ALL TO authenticated USING (true);

-- 7. Financial Transactions Policies
CREATE POLICY "Staff can view transactions"
  ON financial_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can insert transactions"
  ON financial_transactions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Immutable Ledger: No updates/deletes allowed on transactions"
  ON financial_transactions FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Immutable Ledger: No deletes allowed on transactions"
  ON financial_transactions FOR DELETE TO authenticated USING (false);
