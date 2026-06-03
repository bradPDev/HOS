import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isUsingMock = !supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-');

// Helper to seed localStorage mock database
const seedMockDB = () => {
  if (!localStorage.getItem('hos_room_types')) {
    const roomTypes = [
      {
        id: 'rt-1',
        name: 'Deluxe Room',
        description: 'An elegant room featuring a king-size bed, luxury linens, a dedicated workspace, and a private balcony overlooking the city skyline.',
        max_capacity: 2,
        base_rate: 3500.00,
        image_url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80',
        created_at: new Date().toISOString()
      },
      {
        id: 'rt-2',
        name: 'Executive Suite',
        description: 'A spacious two-room suite offering a separate living salon, marble dining area, premium coffee station, and a spa-inspired bathroom.',
        max_capacity: 4,
        base_rate: 6500.00,
        image_url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
        created_at: new Date().toISOString()
      },
      {
        id: 'rt-3',
        name: 'Presidential Penthouse',
        description: 'The ultimate luxury experience. Spans the top floor with panoramic glass walls, private terrace pool, full kitchen, and personalized butler service.',
        max_capacity: 6,
        base_rate: 15000.00,
        image_url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80',
        created_at: new Date().toISOString()
      }
    ];
    localStorage.setItem('hos_room_types', JSON.stringify(roomTypes));
  }

  if (!localStorage.getItem('hos_rooms')) {
    const rooms = [
      { id: '101', room_type_id: 'rt-1', status: 'available', created_at: new Date().toISOString() },
      { id: '102', room_type_id: 'rt-1', status: 'available', created_at: new Date().toISOString() },
      { id: '103', room_type_id: 'rt-1', status: 'dirty', created_at: new Date().toISOString() },
      { id: '201', room_type_id: 'rt-2', status: 'available', created_at: new Date().toISOString() },
      { id: '202', room_type_id: 'rt-2', status: 'occupied', created_at: new Date().toISOString() },
      { id: '301', room_type_id: 'rt-3', status: 'available', created_at: new Date().toISOString() }
    ];
    localStorage.setItem('hos_rooms', JSON.stringify(rooms));
  }

  if (!localStorage.getItem('hos_profiles')) {
    const profiles = [
      { id: 'u-admin', first_name: 'Bradley', last_name: 'Mosuela', role: 'admin', status: 'active', email: 'admin@hos.com', created_at: new Date().toISOString() },
      { id: 'u-front', first_name: 'Sarah', last_name: 'Jenkins', role: 'front_desk', status: 'active', email: 'frontdesk@hos.com', created_at: new Date().toISOString() },
      { id: 'u-house', first_name: 'Manuel', last_name: 'Santos', role: 'housekeeping', status: 'active', email: 'housekeeping@hos.com', created_at: new Date().toISOString() }
    ];
    localStorage.setItem('hos_profiles', JSON.stringify(profiles));
  }

  if (!localStorage.getItem('hos_reservations')) {
    const reservations = [
      {
        id: 'res-1',
        booking_ref: 'HOS-72A9B',
        guest_first_name: 'John',
        guest_last_name: 'Doe',
        guest_email: 'johndoe@example.com',
        guest_phone: '+63 917 123 4567',
        check_in_date: new Date(Date.now() - 86400000).toISOString().split('T')[0], // yesterday
        check_out_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], // 2 days from now
        room_type_id: 'rt-2',
        room_id: '202',
        status: 'checked_in',
        payment_status: 'captured',
        payment_method: 'online',
        incidental_deposit_amount: 1000.00,
        incidental_deposit_method: 'cash',
        incidental_deposit_status: 'held',
        special_requests: 'Near the elevator please.',
        created_at: new Date(Date.now() - 86400000 * 5).toISOString()
      },
      {
        id: 'res-2',
        booking_ref: 'HOS-88F1C',
        guest_first_name: 'Jane',
        guest_last_name: 'Smith',
        guest_email: 'janesmith@example.com',
        guest_phone: '+63 918 987 6543',
        check_in_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // tomorrow
        check_out_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], // 3 days from now
        room_type_id: 'rt-1',
        room_id: '101',
        status: 'confirmed',
        payment_status: 'captured',
        payment_method: 'online',
        incidental_deposit_amount: 0.00,
        incidental_deposit_method: null,
        incidental_deposit_status: 'none',
        special_requests: 'King bed preferred.',
        created_at: new Date(Date.now() - 86400000 * 2).toISOString()
      }
    ];
    localStorage.setItem('hos_reservations', JSON.stringify(reservations));
  }

  if (!localStorage.getItem('hos_maintenance_tickets')) {
    const tickets = [
      {
        id: 'mt-1',
        room_id: '103',
        description: 'AC unit is blowing warm air.',
        is_critical: false,
        status: 'open',
        created_at: new Date().toISOString()
      }
    ];
    localStorage.setItem('hos_maintenance_tickets', JSON.stringify(tickets));
  }

  if (!localStorage.getItem('hos_financial_transactions')) {
    const tx = [
      {
        id: 'tx-1',
        reservation_id: 'res-1',
        shift_id: null,
        amount: 13000.00, // 2 nights of rt-2
        type: 'payment',
        payment_method: 'online',
        status: 'settled',
        created_at: new Date(Date.now() - 86400000 * 5).toISOString()
      },
      {
        id: 'tx-2',
        reservation_id: 'res-1',
        shift_id: 'shift-mock',
        amount: 1000.00,
        type: 'deposit_hold',
        payment_method: 'cash',
        status: 'settled',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        processed_by: 'u-front'
      }
    ];
    localStorage.setItem('hos_financial_transactions', JSON.stringify(tx));
  }

  if (!localStorage.getItem('hos_shifts')) {
    localStorage.setItem('hos_shifts', JSON.stringify([]));
  }
};

if (isUsingMock) {
  seedMockDB();
}

// Supabase Real Client
const realSupabase = isUsingMock ? null : createClient(supabaseUrl, supabaseAnonKey);

// Generic Mock Query Builder (Thenable for compatibility with Supabase JS client)
class MockQueryBuilder {
  private tableName: string;
  private filters: Array<(item: any) => boolean> = [];
  private limitCount: number | null = null;
  private orderField: string | null = null;
  private orderAsc: boolean = true;
  private queryAction: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private queryPayload: any = null;
  private selectColumns: string = '*';

  constructor(tableName: string) {
    this.tableName = `hos_${tableName}`;
  }

  private getItems(): any[] {
    const data = localStorage.getItem(this.tableName);
    return data ? JSON.parse(data) : [];
  }

  private setItems(items: any[]) {
    localStorage.setItem(this.tableName, JSON.stringify(items));
  }

  select(columns = '*') {
    this.queryAction = 'select';
    this.selectColumns = columns;
    return this;
  }

  insert(payload: any) {
    this.queryAction = 'insert';
    this.queryPayload = payload;
    return this;
  }

  update(payload: any) {
    this.queryAction = 'update';
    this.queryPayload = payload;
    return this;
  }

  delete() {
    this.queryAction = 'delete';
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push(item => item[field] === value);
    return this;
  }

  neq(field: string, value: any) {
    this.filters.push(item => item[field] !== value);
    return this;
  }

  gte(field: string, value: any) {
    this.filters.push(item => item[field] >= value);
    return this;
  }

  lte(field: string, value: any) {
    this.filters.push(item => item[field] <= value);
    return this;
  }

  in(field: string, values: any[]) {
    this.filters.push(item => values.includes(item[field]));
    return this;
  }

  or(_filterString: string) {
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  order(field: string, { ascending = true } = {}) {
    this.orderField = field;
    this.orderAsc = ascending;
    return this;
  }

  // Promise-like then method so this class can be awaited
  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    try {
      if (this.queryAction === 'select') {
        let items = this.getItems();
        
        // Apply filters
        for (const filter of this.filters) {
          items = items.filter(filter);
        }

        // Apply sorting
        if (this.orderField) {
          items.sort((a, b) => {
            const valA = a[this.orderField!];
            const valB = b[this.orderField!];
            if (valA < valB) return this.orderAsc ? -1 : 1;
            if (valA > valB) return this.orderAsc ? 1 : -1;
            return 0;
          });
        }

        // Apply limit
        if (this.limitCount !== null) {
          items = items.slice(0, this.limitCount);
        }

        // Joins mock: if selecting rooms and referencing room_types
        if (this.tableName === 'hos_rooms' && this.selectColumns.includes('room_types')) {
          const types = JSON.parse(localStorage.getItem('hos_room_types') || '[]');
          items = items.map(room => ({
            ...room,
            room_types: types.find((t: any) => t.id === room.room_type_id)
          }));
        }

        // Joins mock: if selecting reservations and referencing room_types or rooms
        if (this.tableName === 'hos_reservations') {
          const types = JSON.parse(localStorage.getItem('hos_room_types') || '[]');
          const rooms = JSON.parse(localStorage.getItem('hos_rooms') || '[]');
          items = items.map(res => ({
            ...res,
            room_types: types.find((t: any) => t.id === res.room_type_id),
            rooms: rooms.find((r: any) => r.id === res.room_id)
          }));
        }

        // Joins mock: if selecting financial transactions and referencing reservations
        if (this.tableName === 'hos_financial_transactions') {
          const reservations = JSON.parse(localStorage.getItem('hos_reservations') || '[]');
          items = items.map(t => ({
            ...t,
            reservations: reservations.find((r: any) => r.id === t.reservation_id)
          }));
        }

        return { data: items, error: null };
      }

      if (this.queryAction === 'insert') {
        const items = this.getItems();
        const recordsToInsert = Array.isArray(this.queryPayload) ? this.queryPayload : [this.queryPayload];
        
        const newRecords = recordsToInsert.map(record => ({
          id: record.id || uuidMock(),
          created_at: new Date().toISOString(),
          ...record
        }));

        const updated = [...items, ...newRecords];
        this.setItems(updated);

        // Perform cascading logic if needed (matching SQL triggers)
        for (const record of newRecords) {
          this.runMockTriggers('INSERT', record);
        }

        return { data: Array.isArray(this.queryPayload) ? newRecords : newRecords[0], error: null };
      }

      if (this.queryAction === 'update') {
        let items = this.getItems();
        let updatedRecords: any[] = [];

        items = items.map(item => {
          // Evaluate if item matches filters
          let matches = true;
          for (const filter of this.filters) {
            if (!filter(item)) {
              matches = false;
              break;
            }
          }

          if (matches) {
            const updatedItem = { ...item, ...this.queryPayload };
            updatedRecords.push(updatedItem);
            this.runMockTriggers('UPDATE', updatedItem, item);
            return updatedItem;
          }
          return item;
        });

        this.setItems(items);
        return { data: updatedRecords, error: null };
      }

      if (this.queryAction === 'delete') {
        const items = this.getItems();
        const keptItems = items.filter(item => {
          let matches = true;
          for (const filter of this.filters) {
            if (!filter(item)) {
              matches = false;
              break;
            }
          }
          return !matches;
        });

        this.setItems(keptItems);
        return { data: null, error: null };
      }

      return { data: null, error: new Error('Unsupported query action') };
    } catch (e: any) {
      return { data: null, error: e };
    }
  }

  // Local implementation of mock PostgreSQL triggers
  private runMockTriggers(operation: 'INSERT' | 'UPDATE', record: any, oldRecord?: any) {
    // Trigger A: Reservation status changes
    if (this.tableName === 'hos_reservations' && operation === 'UPDATE') {
      const rooms = JSON.parse(localStorage.getItem('hos_rooms') || '[]');
      
      // Check-In -> Occupied
      if (record.status === 'checked_in' && oldRecord?.status !== 'checked_in' && record.room_id) {
        const updatedRooms = rooms.map((r: any) => 
          r.id === record.room_id ? { ...r, status: 'occupied' } : r
        );
        localStorage.setItem('hos_rooms', JSON.stringify(updatedRooms));
      }

      // Check-Out -> Dirty
      if (record.status === 'checked_out' && oldRecord?.status !== 'checked_out' && record.room_id) {
        const updatedRooms = rooms.map((r: any) => 
          r.id === record.room_id ? { ...r, status: 'dirty' } : r
        );
        localStorage.setItem('hos_rooms', JSON.stringify(updatedRooms));
      }
    }

    // Trigger B: Maintenance ticket opens or resolves
    if (this.tableName === 'hos_maintenance_tickets') {
      const rooms = JSON.parse(localStorage.getItem('hos_rooms') || '[]');

      if (operation === 'INSERT' && record.is_critical) {
        // Critical Ticket opened -> Out of Order
        const updatedRooms = rooms.map((r: any) => 
          r.id === record.room_id ? { ...r, status: 'out_of_order' } : r
        );
        localStorage.setItem('hos_rooms', JSON.stringify(updatedRooms));
      } else if (operation === 'UPDATE') {
        if (record.is_critical && !oldRecord?.is_critical) {
          const updatedRooms = rooms.map((r: any) => 
            r.id === record.room_id ? { ...r, status: 'out_of_order' } : r
          );
          localStorage.setItem('hos_rooms', JSON.stringify(updatedRooms));
        } else if (record.status === 'resolved' && oldRecord?.status !== 'resolved' && record.is_critical) {
          // Critical ticket resolved -> Dirty (housekeeping cleans)
          const updatedRooms = rooms.map((r: any) => 
            r.id === record.room_id ? { ...r, status: 'dirty' } : r
          );
          localStorage.setItem('hos_rooms', JSON.stringify(updatedRooms));
        }
      }
    }
  }
}

// Generate mock UUID
const uuidMock = () => {
  return 'mock-uuid-' + Math.random().toString(36).substr(2, 9);
};

// Mock Authentication Client
class MockAuthClient {
  // getSessionUser was removed as it was unused

  async signInWithPassword({ email, password: _password }: any) {
    const profiles = JSON.parse(localStorage.getItem('hos_profiles') || '[]');
    const user = profiles.find((p: any) => p.email.toLowerCase() === email.toLowerCase());
    
    if (user) {
      const session = {
        access_token: 'mock-token',
        user: {
          id: user.id,
          email: user.email,
          user_metadata: {
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role
          }
        }
      };
      localStorage.setItem('hos_session', JSON.stringify(session));
      this.triggerAuthChange('SIGNED_IN', session);
      return { data: session, error: null };
    }
    return { data: { session: null, user: null }, error: new Error('Invalid email or password.') };
  }

  async signOut() {
    localStorage.removeItem('hos_session');
    this.triggerAuthChange('SIGNED_OUT', null);
    return { error: null };
  }

  async getSession() {
    const sess = localStorage.getItem('hos_session');
    if (sess) {
      return { data: { session: JSON.parse(sess) }, error: null };
    }
    return { data: { session: null }, error: null };
  }

  private listeners: Array<(event: string, session: any) => void> = [];

  onAuthStateChange(callback: (event: string, session: any) => void) {
    this.listeners.push(callback);
    // Trigger initial callback
    const sess = localStorage.getItem('hos_session');
    const session = sess ? JSON.parse(sess) : null;
    callback(session ? 'SIGNED_IN' : 'INITIAL_SESSION', session);

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners = this.listeners.filter(l => l !== callback);
          }
        }
      }
    };
  }

  private triggerAuthChange(event: string, session: any) {
    this.listeners.forEach(l => l(event, session));
  }
}

// Mock Supabase Client Object
const mockSupabase = {
  auth: new MockAuthClient(),
  from: (table: string) => new MockQueryBuilder(table),
  rpc(fnName: string, _params?: any) {
    // Mock RPC calls
    if (fnName === 'release_expired_holds') {
      const reservations = JSON.parse(localStorage.getItem('hos_reservations') || '[]');
      let count = 0;
      const updated = reservations.map((res: any) => {
        if (res.status === 'pending' && res.payment_status === 'unpaid' && new Date(res.hold_expires_at) < new Date()) {
          count++;
          return { ...res, status: 'abandoned' };
        }
        return res;
      });
      localStorage.setItem('hos_reservations', JSON.stringify(updated));
      return Promise.resolve({ data: count, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }
};

// Export active client (Real or Mock)
export const supabase = isUsingMock ? (mockSupabase as any) : realSupabase!;
