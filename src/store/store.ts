import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'front_desk' | 'housekeeping';
  status: 'pending' | 'active' | 'suspended' | 'locked';
  email: string;
}

export interface RoomType {
  id: string;
  name: string;
  description: string;
  max_capacity: number;
  base_rate: number;
  image_url: string;
}

export interface Room {
  id: string;
  room_type_id: string;
  status: 'available' | 'occupied' | 'dirty' | 'cleaning' | 'out_of_order';
  room_types?: RoomType;
}

export interface Reservation {
  id: string;
  booking_ref: string;
  guest_first_name: string;
  guest_last_name: string;
  guest_email: string;
  guest_phone: string;
  check_in_date: string;
  check_out_date: string;
  room_type_id: string;
  room_id: string | null;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'canceled' | 'abandoned';
  payment_status: 'unpaid' | 'processing' | 'captured' | 'declined';
  payment_method: string | null;
  incidental_deposit_amount: number;
  incidental_deposit_method: string | null;
  incidental_deposit_status: 'none' | 'held' | 'refunded' | 'forfeited';
  special_requests: string;
  hold_expires_at: string | null;
  created_at: string;
  room_types?: RoomType;
  rooms?: Room;
}

export interface MaintenanceTicket {
  id: string;
  room_id: string;
  description: string;
  is_critical: boolean;
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
  resolved_at?: string | null;
}

export interface Shift {
  id: string;
  staff_id: string;
  start_time: string;
  end_time: string | null;
  starting_cash: number;
  expected_cash: number;
  actual_cash: number | null;
  variance: number | null;
  status: 'active' | 'closed';
  closed_by_admin_id?: string | null;
}

export interface FinancialTransaction {
  id: string;
  reservation_id: string;
  shift_id: string | null;
  amount: number;
  type: 'payment' | 'refund' | 'deposit_hold' | 'deposit_refund' | 'deposit_forfeit';
  payment_method: 'online' | 'cash' | 'card_terminal';
  status: 'settled' | 'voided';
  created_at: string;
  processed_by?: string | null;
  reservations?: Reservation;
}

interface BookingCart {
  checkInDate: string;
  checkOutDate: string;
  guestsCount: number;
  selectedRoomTypeId: string | null;
  holdExpiresAt: number | null; // Milliseconds timestamp
}

interface SystemSettings {
  hotelName: string;
  taxRate: number; // Percentage, e.g. 12%
}

interface AppState {
  // Auth state
  user: UserProfile | null;
  isLoadingAuth: boolean;
  setUser: (user: UserProfile | null) => void;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;

  // Booking Cart
  cart: BookingCart;
  setCartDates: (checkIn: string, checkOut: string, guests: number) => void;
  selectRoomType: (roomTypeId: string | null) => void;
  resetCart: () => void;
  setHoldExpiresAt: (expiresAt: number | null) => void;

  // Active Shift State
  activeShift: Shift | null;
  startShift: (startingCash: number) => Promise<Shift>;
  closeShift: (actualCash: number, adminPIN?: string) => Promise<{ success: boolean; variance: number; discrepancy: boolean }>;
  syncShiftExpectedCash: () => Promise<void>;

  // Global settings
  settings: SystemSettings;
  updateTaxRate: (rate: number) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Auth state
  user: null,
  isLoadingAuth: true,
  setUser: (user) => set({ user }),
  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .limit(1);

      if (profile && profile.length > 0) {
        set({ user: { ...profile[0], email } });
        
        // Fetch active shift if role is front_desk or admin
        if (profile[0].role !== 'housekeeping') {
          const { data: activeShifts } = await supabase
            .from('shifts')
            .select('*')
            .eq('staff_id', data.user.id)
            .eq('status', 'active')
            .limit(1);
          
          if (activeShifts && activeShifts.length > 0) {
            set({ activeShift: activeShifts[0] });
          } else {
            set({ activeShift: null });
          }
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('Sign in failed:', err);
      return false;
    }
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, activeShift: null });
  },

  // Booking Cart
  cart: {
    checkInDate: '',
    checkOutDate: '',
    guestsCount: 1,
    selectedRoomTypeId: null,
    holdExpiresAt: null,
  },
  setCartDates: (checkIn, checkOut, guests) => 
    set((state) => ({ cart: { ...state.cart, checkInDate: checkIn, checkOutDate: checkOut, guestsCount: guests } })),
  selectRoomType: (roomTypeId) => 
    set((state) => ({ cart: { ...state.cart, selectedRoomTypeId: roomTypeId } })),
  resetCart: () => 
    set(() => ({
      cart: {
        checkInDate: '',
        checkOutDate: '',
        guestsCount: 1,
        selectedRoomTypeId: null,
        holdExpiresAt: null,
      }
    })),
  setHoldExpiresAt: (expiresAt) => 
    set((state) => ({ cart: { ...state.cart, holdExpiresAt: expiresAt } })),

  // Active Shift State
  activeShift: null,
  startShift: async (startingCash) => {
    const user = get().user;
    if (!user) throw new Error('User must be logged in to start a shift.');

    // Starting expected cash is the starting cash
    const { data: newShift, error } = await supabase
      .from('shifts')
      .insert({
        staff_id: user.id,
        starting_cash: startingCash,
        expected_cash: startingCash,
        status: 'active'
      })
      .select();

    if (error || !newShift) throw error || new Error('Failed to start shift');

    set({ activeShift: newShift });
    return newShift;
  },

  closeShift: async (actualCash, adminPIN) => {
    const activeShift = get().activeShift;
    const user = get().user;
    if (!activeShift || !user) throw new Error('No active shift to close.');

    // Double check expected cash by running a manual sum over all payments & deposit movements in this shift
    const { data: transactions } = await supabase
      .from('financial_transactions')
      .select('*')
      .eq('shift_id', activeShift.id);

    let cashBalanceChange = 0;
    if (transactions) {
      transactions.forEach((tx: any) => {
        if (tx.payment_method === 'cash' && tx.status === 'settled') {
          if (tx.type === 'payment' || tx.type === 'deposit_hold') {
            cashBalanceChange += Number(tx.amount);
          } else if (tx.type === 'refund' || tx.type === 'deposit_refund') {
            cashBalanceChange -= Number(tx.amount);
          } else if (tx.type === 'deposit_forfeit') {
            // Cash deposit forfeit changes it from liability to revenue, no net drawer cash change since cash is already in the drawer
          }
        }
      });
    }

    const calculatedExpected = Number(activeShift.starting_cash) + cashBalanceChange;
    const variance = actualCash - calculatedExpected;
    const discrepancy = Math.abs(variance) > 0.01;

    // If discrepancy, requires Admin PIN override (mock check: any admin PIN works, or user role is admin)
    if (discrepancy && user.role !== 'admin' && !adminPIN) {
      return { success: false, variance, discrepancy: true };
    }

    // Prepare updates
    const updates = {
      end_time: new Date().toISOString(),
      expected_cash: calculatedExpected,
      actual_cash: actualCash,
      variance: variance,
      status: 'closed',
      closed_by_admin_id: user.role === 'admin' ? user.id : (adminPIN ? 'u-admin' : null) // Mock admin approval ID
    };

    const { error } = await supabase
      .from('shifts')
      .update(updates)
      .eq('id', activeShift.id);

    if (error) throw error;

    set({ activeShift: null });
    return { success: true, variance, discrepancy };
  },

  syncShiftExpectedCash: async () => {
    const activeShift = get().activeShift;
    if (!activeShift) return;

    // Sum cash transaction values
    const { data: transactions } = await supabase
      .from('financial_transactions')
      .select('*')
      .eq('shift_id', activeShift.id);

    let cashBalanceChange = 0;
    if (transactions) {
      transactions.forEach((tx: any) => {
        if (tx.payment_method === 'cash' && tx.status === 'settled') {
          if (tx.type === 'payment' || tx.type === 'deposit_hold') {
            cashBalanceChange += Number(tx.amount);
          } else if (tx.type === 'refund' || tx.type === 'deposit_refund') {
            cashBalanceChange -= Number(tx.amount);
          }
        }
      });
    }

    const calculatedExpected = Number(activeShift.starting_cash) + cashBalanceChange;

    const { data: updated } = await supabase
      .from('shifts')
      .update({ expected_cash: calculatedExpected })
      .eq('id', activeShift.id)
      .select();

    if (updated && updated.length > 0) {
      set({ activeShift: updated[0] });
    }
  },

  // Global settings
  settings: {
    hotelName: 'HOS Grand Plaza',
    taxRate: 12.0
  },
  updateTaxRate: (rate) => set((state) => ({ settings: { ...state.settings, taxRate: rate } }))
}));

// Initialize auth subscription on load
supabase.auth.onAuthStateChange(async (_event: string, session: any) => {
  if (session && session.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .limit(1)
      .select();

    if (profile && profile.length > 0) {
      useStore.getState().setUser({
        ...profile[0],
        email: session.user.email
      });

      // Fetch active shift
      if (profile[0].role !== 'housekeeping') {
        const { data: activeShifts } = await supabase
          .from('shifts')
          .select('*')
          .eq('staff_id', session.user.id)
          .eq('status', 'active')
          .limit(1)
          .select();
        
        if (activeShifts && activeShifts.length > 0) {
          useStore.setState({ activeShift: activeShifts[0] });
        }
      }
    }
  } else {
    useStore.setState({ user: null, activeShift: null });
  }
  useStore.setState({ isLoadingAuth: false });
});
