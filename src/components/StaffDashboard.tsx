import React, { useState, useEffect } from 'react';
import { useStore } from '../store/store';
import type { UserProfile, Room, RoomType, Reservation, MaintenanceTicket, FinancialTransaction } from '../store/store';
import { supabase } from '../lib/supabaseClient';
import { 
  Users, Key, AlertCircle, ClipboardList, Settings, DollarSign, LogOut, Wrench, 
  ShieldAlert, Sparkles, RefreshCw, Plus, Search, X
} from 'lucide-react';

interface StaffDashboardProps {
  onGoToStorefront: () => void;
}

export const StaffDashboard: React.FC<StaffDashboardProps> = ({ onGoToStorefront }) => {
  const { user, signIn, signOut, activeShift, startShift, closeShift, syncShiftExpectedCash, settings, updateTaxRate } = useStore();
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'reservations' | 'housekeeping' | 'maintenance' | 'finance' | 'admin'>('reservations');

  // Shared Data States
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Modals / Form States
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState<Reservation | null>(null);
  const [showCheckOutModal, setShowCheckOutModal] = useState<Reservation | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false); // Open Shift
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false); // Close Shift

  // Form Fields
  const [walkInForm, setWalkInForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    checkInDate: new Date().toISOString().split('T')[0],
    checkOutDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    roomTypeId: '', roomId: '', paymentMethod: 'cash',
    depositAmount: 1000, depositMethod: 'cash', specialRequests: ''
  });
  const [checkInDeposit, setCheckInDeposit] = useState({ amount: 1000, method: 'cash' });
  const [checkOutResolution, setCheckOutResolution] = useState<'refund' | 'forfeit_full' | 'forfeit_partial'>('refund');
  const [checkOutForfeitAmount, setCheckOutForfeitAmount] = useState(0);
  const [newTicket, setNewTicket] = useState({ roomId: '', description: '', isCritical: false });
  const [newStaff, setNewStaff] = useState({ firstName: '', lastName: '', email: '', role: 'front_desk' as any });
  const [startingCashInput, setStartingCashInput] = useState(5000);
  const [actualCashInput, setActualCashInput] = useState(0);
  const [adminPINInput, setAdminPINInput] = useState('');
  
  // Search & Filtering
  const [resSearch, setResSearch] = useState('');
  const [resStatusFilter, setResStatusFilter] = useState('all');
  const [hkFilter, setHkFilter] = useState('all');

  // Reconciliation Warning
  const [reconError, setReconError] = useState<string | null>(null);
  const [reconNeedsOverride, setReconNeedsOverride] = useState(false);

  // Load Database Data
  const loadDashboardData = async () => {
    if (!user) return;
    setIsLoadingData(true);
    try {
      const { data: rmTypes } = await supabase.from('room_types').select('*');
      if (rmTypes) setRoomTypes(rmTypes);

      const { data: rms } = await supabase.from('rooms').select('*, room_types(*)');
      if (rms) setRooms(rms);

      const { data: resvs } = await supabase.from('reservations').select('*, room_types(*), rooms(*)');
      if (resvs) setReservations(resvs);

      const { data: tix } = await supabase.from('maintenance_tickets').select('*');
      if (tix) setTickets(tix);

      const { data: txs } = await supabase.from('financial_transactions').select('*, reservations(*)');
      if (txs) setTransactions(txs);

      const { data: staff } = await supabase.from('profiles').select('*');
      if (staff) setStaffList(staff);
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDashboardData();
      // Auto routing if user has role constraints
      if (user.role === 'housekeeping') {
        setActiveTab('housekeeping');
      }
    }
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) return;
    setIsLoggingIn(true);
    const success = await signIn(emailInput, passwordInput);
    setIsLoggingIn(false);
    if (!success) {
      alert('Login failed. Please check your email and password.');
    }
  };

  const handleStartShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await startShift(startingCashInput);
      setShowShiftModal(false);
      loadDashboardData();
    } catch (err) {
      console.error(err);
      alert('Error opening shift.');
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setReconError(null);
    try {
      const result = await closeShift(actualCashInput, adminPINInput);
      if (result.success) {
        setShowCloseShiftModal(false);
        setReconNeedsOverride(false);
        setAdminPINInput('');
        alert(`Shift Closed Successfully. Shift Variance: ₱${result.variance.toFixed(2)}`);
        loadDashboardData();
      } else if (result.discrepancy) {
        setReconNeedsOverride(true);
        setReconError(`Warning: Drawer cash discrepancy detected (Variance: ₱${result.variance.toFixed(2)}). An Admin override code or Admin login session is required to force close this shift.`);
      }
    } catch (err) {
      console.error(err);
      alert('Error closing shift.');
    }
  };

  // Walk-in booking submit
  const handleWalkInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInForm.firstName || !walkInForm.lastName || !walkInForm.roomId) {
      alert('Please fill out all required fields.');
      return;
    }

    try {
      const bookingRef = 'HOS-' + Math.random().toString(36).substring(2, 7).toUpperCase();
      
      // 1. Create Confirmed reservation directly
      const { data: res, error: resError } = await supabase
        .from('reservations')
        .insert({
          booking_ref: bookingRef,
          guest_first_name: walkInForm.firstName,
          guest_last_name: walkInForm.lastName,
          guest_email: walkInForm.email || 'walkin@guest.com',
          guest_phone: walkInForm.phone || 'N/A',
          check_in_date: walkInForm.checkInDate,
          check_out_date: walkInForm.checkOutDate,
          room_type_id: walkInForm.roomTypeId,
          room_id: walkInForm.roomId,
          status: 'confirmed',
          payment_status: 'captured',
          payment_method: walkInForm.paymentMethod
        })
        .select();

      if (resError || !res) throw resError || new Error('Failed to create reservation');

      // 2. Add Revenue Transaction
      const rt = roomTypes.find(t => t.id === walkInForm.roomTypeId);
      const diff = new Date(walkInForm.checkOutDate).getTime() - new Date(walkInForm.checkInDate).getTime();
      const nights = Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
      const baseCost = (rt?.base_rate || 0) * nights;
      const totalCost = Number((baseCost * 1.12).toFixed(2));

      await supabase.from('financial_transactions').insert({
        reservation_id: res[0].id,
        shift_id: activeShift?.id,
        amount: totalCost,
        type: 'payment',
        payment_method: walkInForm.paymentMethod,
        processed_by: user?.id
      });

      // 3. Mark room status to Occupied immediately (Walk-in check-in skip option)
      // If checking in immediately, we should also request the deposit
      alert(`Walk-In Reservation Created Successfully. Booking Reference: ${bookingRef}`);
      setShowWalkInModal(false);
      loadDashboardData();
      if (activeShift) syncShiftExpectedCash();
    } catch (err) {
      console.error(err);
      alert('Error creating walk-in reservation.');
    }
  };

  // Check-In Submit
  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCheckInModal) return;

    try {
      const res = showCheckInModal;
      
      // Enforce Clean Room Mandate (Early Check-In / Dirty Room Block)
      const room = rooms.find(r => r.id === res.room_id);
      if (room && room.status !== 'available') {
        alert("Room not ready. Reassign room or await Housekeeping clearance.");
        return;
      }

      // 1. Log Incidental Deposit Liability
      await supabase.from('financial_transactions').insert({
        reservation_id: res.id,
        shift_id: activeShift?.id,
        amount: checkInDeposit.amount,
        type: 'deposit_hold',
        payment_method: checkInDeposit.method,
        processed_by: user?.id
      });

      // 2. Update Reservation status to checked_in
      await supabase
        .from('reservations')
        .update({
          status: 'checked_in',
          incidental_deposit_amount: checkInDeposit.amount,
          incidental_deposit_method: checkInDeposit.method,
          incidental_deposit_status: 'held'
        })
        .eq('id', res.id);

      // Trigger handles room change to occupied
      setShowCheckInModal(null);
      alert(`Checked In room successfully.`);
      loadDashboardData();
      if (activeShift) syncShiftExpectedCash();
    } catch (err) {
      console.error(err);
      alert('Error checking in guest.');
    }
  };

  // Check-Out Submit
  const handleCheckOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCheckOutModal) return;

    try {
      const res = showCheckOutModal;
      const depositAmount = Number(res.incidental_deposit_amount);

      // 1. Log Deposit Resolution Transaction
      if (checkOutResolution === 'refund') {
        // Log Negative refund transaction
        await supabase.from('financial_transactions').insert({
          reservation_id: res.id,
          shift_id: activeShift?.id,
          amount: depositAmount,
          type: 'deposit_refund',
          payment_method: res.incidental_deposit_method as any,
          processed_by: user?.id
        });
      } else if (checkOutResolution === 'forfeit_full') {
        // Log Forfeit transaction
        await supabase.from('financial_transactions').insert({
          reservation_id: res.id,
          shift_id: activeShift?.id,
          amount: depositAmount,
          type: 'deposit_forfeit',
          payment_method: res.incidental_deposit_method as any,
          processed_by: user?.id
        });
      } else if (checkOutResolution === 'forfeit_partial') {
        const refundAmt = depositAmount - checkOutForfeitAmount;
        // Refund portion
        if (refundAmt > 0) {
          await supabase.from('financial_transactions').insert({
            reservation_id: res.id,
            shift_id: activeShift?.id,
            amount: refundAmt,
            type: 'deposit_refund',
            payment_method: res.incidental_deposit_method as any,
            processed_by: user?.id
          });
        }
        // Forfeit portion
        if (checkOutForfeitAmount > 0) {
          await supabase.from('financial_transactions').insert({
            reservation_id: res.id,
            shift_id: activeShift?.id,
            amount: checkOutForfeitAmount,
            type: 'deposit_forfeit',
            payment_method: res.incidental_deposit_method as any,
            processed_by: user?.id
          });
        }
      }

      // 2. Update Reservation to Checked-Out
      await supabase
        .from('reservations')
        .update({
          status: 'checked_out',
          incidental_deposit_status: checkOutResolution === 'refund' ? 'refunded' : (checkOutResolution === 'forfeit_full' ? 'forfeit' : 'refunded')
        })
        .eq('id', res.id);

      // Room status transitions to dirty
      setShowCheckOutModal(null);
      alert(`Checked Out guest successfully. Room assigned is now Dirty.`);
      loadDashboardData();
      if (activeShift) syncShiftExpectedCash();
    } catch (err) {
      console.error(err);
      alert('Error checking out guest.');
    }
  };

  // Housekeeping status update
  const handleUpdateRoomStatus = async (roomId: string, nextStatus: Room['status']) => {
    try {
      await supabase
        .from('rooms')
        .update({ status: nextStatus })
        .eq('id', roomId);
      loadDashboardData();
    } catch (e) {
      console.error(e);
    }
  };

  // Maintenance ticket submit
  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.roomId || !newTicket.description) return;
    try {
      await supabase.from('maintenance_tickets').insert({
        room_id: newTicket.roomId,
        description: newTicket.description,
        is_critical: newTicket.isCritical,
        status: 'open'
      });
      setShowTicketModal(false);
      setNewTicket({ roomId: '', description: '', isCritical: false });
      loadDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveTicket = async (ticketId: string) => {
    try {
      await supabase
        .from('maintenance_tickets')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', ticketId);
      loadDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  // Staff creation (soft-delete is suspension)
  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.email || !newStaff.firstName) return;
    try {
      const mockId = 'u-' + Math.random().toString(36).substr(2, 5);
      await supabase.from('profiles').insert({
        id: mockId,
        first_name: newStaff.firstName,
        last_name: newStaff.lastName,
        role: newStaff.role,
        status: 'active',
        email: newStaff.email
      });
      setShowStaffModal(false);
      setNewStaff({ firstName: '', lastName: '', email: '', role: 'front_desk' });
      loadDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStaffStatus = async (staffId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await supabase
        .from('profiles')
        .update({ status: nextStatus })
        .eq('id', staffId);
      loadDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val);
  };

  // If not logged in, render simple login portal
  if (!user) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass-panel fade-in" style={{ width: '100%', maxWidth: '420px', padding: '36px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'inline-flex', padding: '12px', background: 'var(--gold-glow)', borderRadius: '12px', color: 'var(--gold-light)', marginBottom: '16px' }}>
              <Key size={32} />
            </div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '6px' }}>Staff Dashboard</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Secure Portal authentication required.</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Employee Email</label>
              <input
                type="email"
                className="input-field"
                required
                placeholder="e.g. frontdesk@hos.com"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label">Password</label>
              <input
                type="password"
                className="input-field"
                required
                placeholder="Enter password"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
              />
              <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Demo credentials: Use registered email/password or local credentials.
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '44px', marginTop: '16px' }} disabled={isLoggingIn}>
              {isLoggingIn ? 'Verifying Credentials...' : 'Authenticate'}
            </button>
          </form>
          
          <button onClick={onGoToStorefront} className="btn btn-secondary" style={{ width: '100%', marginTop: '16px', height: '44px' }}>
            Back to Public Site
          </button>
        </div>
      </div>
    );
  }

  // Filter reservations
  const filteredReservations = reservations.filter(res => {
    const fullName = `${res.guest_first_name} ${res.guest_last_name}`.toLowerCase();
    const matchesSearch = fullName.includes(resSearch.toLowerCase()) || res.booking_ref.toLowerCase().includes(resSearch.toLowerCase());
    const matchesStatus = resStatusFilter === 'all' || res.status === resStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="app-container" style={{ padding: '0 0 80px' }}>
      
      {/* Control Strip / Top Bar */}
      <header className="navbar">
        <div className="nav-brand">
          <Sparkles className="gold-text" style={{ color: 'var(--gold-light)' }} />
          <span>HOS</span> Grand Plaza <span>• Staff Console</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{user.first_name} {user.last_name}</div>
            <div className="badge badge-occupied" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>{user.role}</div>
          </div>
          
          {user.role !== 'housekeeping' && (
            activeShift ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="badge badge-available" style={{ padding: '6px 12px' }}>
                  Drawer Active: {formatCurrency(activeShift.expected_cash)}
                </span>
                <button onClick={() => { setActualCashInput(activeShift.expected_cash); setShowCloseShiftModal(true); }} className="btn btn-danger" style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
                  Close Shift
                </button>
              </div>
            ) : (
              <button onClick={() => setShowShiftModal(true)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
                Open Drawer Shift
              </button>
            )
          )}

          <button onClick={signOut} className="btn btn-secondary" style={{ padding: '8px', borderRadius: '8px' }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Tabs list */}
      <div style={{ maxWidth: '1200px', margin: '30px auto 0', width: '100%', padding: '0 20px' }}>
        <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap' }}>
          
          {user.role !== 'housekeeping' && (
            <button 
              onClick={() => setActiveTab('reservations')} 
              className={`nav-link ${activeTab === 'reservations' ? 'active' : ''}`}
            >
              <ClipboardList size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Reservations
            </button>
          )}

          <button 
            onClick={() => setActiveTab('housekeeping')} 
            className={`nav-link ${activeTab === 'housekeeping' ? 'active' : ''}`}
          >
            <Users size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Housekeeping Status
          </button>

          {user.role !== 'housekeeping' && (
            <button 
              onClick={() => setActiveTab('maintenance')} 
              className={`nav-link ${activeTab === 'maintenance' ? 'active' : ''}`}
            >
              <Wrench size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Maintenance Tickets
            </button>
          )}

          {user.role !== 'housekeeping' && (
            <button 
              onClick={() => setActiveTab('finance')} 
              className={`nav-link ${activeTab === 'finance' ? 'active' : ''}`}
            >
              <DollarSign size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Shift Ledgers
            </button>
          )}

          {user.role === 'admin' && (
            <button 
              onClick={() => setActiveTab('admin')} 
              className={`nav-link ${activeTab === 'admin' ? 'active' : ''}`}
            >
              <Settings size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Admin Panel
            </button>
          )}
        </div>
      </div>

      {/* Tab Panels */}
      <main style={{ maxWidth: '1200px', margin: '24px auto', width: '100%', padding: '0 20px' }}>
        {isLoadingData ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <RefreshCw className="clock-pulse" size={40} style={{ animation: 'spin 1.5s linear infinite', color: 'var(--gold-light)' }} />
            <div style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Synchronizing Database...</div>
          </div>
        ) : (
          <div>
            
            {/* RESERVATIONS TAB */}
            {activeTab === 'reservations' && user.role !== 'housekeeping' && (
              <div className="fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '12px', flex: 1, maxWidth: '600px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input 
                        type="text" 
                        placeholder="Search guest name or reference..." 
                        className="input-field" 
                        value={resSearch}
                        onChange={e => setResSearch(e.target.value)}
                        style={{ paddingLeft: '40px' }}
                      />
                      <Search size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
                    </div>
                    <select 
                      className="input-field" 
                      value={resStatusFilter}
                      onChange={e => setResStatusFilter(e.target.value)}
                      style={{ maxWidth: '180px' }}
                    >
                      <option value="all">All Statuses</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="checked_in">Checked-In</option>
                      <option value="checked_out">Checked-Out</option>
                      <option value="canceled">Canceled</option>
                      <option value="pending">Pending Hold</option>
                    </select>
                  </div>
                  
                  <button 
                    disabled={!activeShift}
                    onClick={() => setShowWalkInModal(true)} 
                    className="btn btn-primary"
                  >
                    <Plus size={16} /> New Walk-In Booking
                  </button>
                </div>

                {!activeShift && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 20px', background: 'hsla(38, 92%, 50%, 0.08)', border: '1px solid var(--status-dirty)', borderRadius: '8px', color: 'var(--status-dirty)', marginBottom: '24px' }}>
                    <AlertCircle size={20} />
                    <span><strong>Shift Drawer Inactive:</strong> You must Open a cash drawer shift before you can process walk-in reservations, check-ins, or check-outs.</span>
                  </div>
                )}

                {/* Reservations Table */}
                <div className="glass-panel" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '16px' }}>Booking Ref</th>
                        <th style={{ padding: '16px' }}>Guest Name</th>
                        <th style={{ padding: '16px' }}>Stay Dates</th>
                        <th style={{ padding: '16px' }}>Room</th>
                        <th style={{ padding: '16px' }}>Reservation Status</th>
                        <th style={{ padding: '16px' }}>Deposit Status</th>
                        <th style={{ padding: '16px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReservations.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No matching reservations found.</td>
                        </tr>
                      ) : (
                        filteredReservations.map(res => (
                          <tr key={res.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                            <td style={{ padding: '16px', fontWeight: 600, color: 'var(--gold-light)' }}>{res.booking_ref}</td>
                            <td style={{ padding: '16px' }}>
                              <div>{res.guest_first_name} {res.guest_last_name}</div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{res.guest_email} • {res.guest_phone}</span>
                            </td>
                            <td style={{ padding: '16px' }}>
                              <div>{res.check_in_date} to {res.check_out_date}</div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{res.room_types?.name}</span>
                            </td>
                            <td style={{ padding: '16px' }}>
                              {res.room_id ? `Room ${res.room_id}` : <span style={{ color: 'var(--status-ooo)' }}>Unassigned</span>}
                            </td>
                            <td style={{ padding: '16px' }}>
                              <span className={`badge badge-${res.status === 'confirmed' ? 'available' : (res.status === 'checked_in' ? 'occupied' : (res.status === 'checked_out' ? 'secondary' : 'ooo'))}`}>
                                {res.status}
                              </span>
                            </td>
                            <td style={{ padding: '16px' }}>
                              {res.incidental_deposit_amount > 0 ? (
                                <div style={{ fontSize: '0.8rem' }}>
                                  <span className={`badge badge-${res.incidental_deposit_status === 'held' ? 'dirty' : 'available'}`} style={{ marginRight: '6px' }}>
                                    {res.incidental_deposit_status}
                                  </span>
                                  {formatCurrency(res.incidental_deposit_amount)}
                                </div>
                              ) : 'None'}
                            </td>
                            <td style={{ padding: '16px', textAlign: 'right' }}>
                              {res.status === 'confirmed' && (
                                <button 
                                  disabled={!activeShift}
                                  onClick={() => setShowCheckInModal(res)} 
                                  className="btn btn-primary" 
                                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                >
                                  Process Check-In
                                </button>
                              )}
                              {res.status === 'checked_in' && (
                                <button 
                                  disabled={!activeShift}
                                  onClick={() => setShowCheckOutModal(res)} 
                                  className="btn btn-danger" 
                                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                >
                                  Process Check-Out
                                </button>
                              )}
                              {res.status === 'pending' && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--status-ooo)' }}>Cart Hold Lock</span>
                              )}
                              {res.status === 'checked_out' && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ledger Closed</span>
                              )}
                              {res.status === 'canceled' && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Voided</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* HOUSEKEEPING TAB */}
            {activeTab === 'housekeeping' && (
              <div className="fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem' }}>Housekeeping Grid</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Cleanliness statuses of the physical hotel inventory.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <select 
                      className="input-field"
                      value={hkFilter}
                      onChange={e => setHkFilter(e.target.value)}
                      style={{ minWidth: '160px' }}
                    >
                      <option value="all">All Rooms</option>
                      <option value="dirty">Dirty Rooms</option>
                      <option value="cleaning">In Progress</option>
                      <option value="available">Available (Clean)</option>
                      <option value="occupied">Occupied</option>
                      <option value="out_of_order">Out of Order</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
                  {rooms
                    .filter(rm => hkFilter === 'all' || rm.status === hkFilter)
                    .map(rm => (
                      <div key={rm.id} className="glass-panel" style={{ padding: '24px', borderLeft: `4px solid var(--status-${rm.status})` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '14px' }}>
                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Room</span>
                            <h3 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{rm.id}</h3>
                          </div>
                          <span className={`badge badge-${rm.status}`}>{rm.status}</span>
                        </div>
                        
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                          Type: <strong>{rm.room_types?.name}</strong>
                        </div>

                        {/* Control buttons */}
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', gap: '10px' }}>
                          {rm.status === 'dirty' && (
                            <button 
                              onClick={() => handleUpdateRoomStatus(rm.id, 'cleaning')}
                              className="btn btn-secondary" 
                              style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }}
                            >
                              Start Cleaning
                            </button>
                          )}
                          {rm.status === 'cleaning' && (
                            <button 
                              onClick={() => handleUpdateRoomStatus(rm.id, 'available')}
                              className="btn btn-primary" 
                              style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }}
                            >
                              Mark Available
                            </button>
                          )}
                          {rm.status === 'available' && (
                            <button 
                              onClick={() => handleUpdateRoomStatus(rm.id, 'dirty')}
                              className="btn btn-secondary" 
                              style={{ width: '100%', fontSize: '0.8rem', padding: '6px', borderColor: 'var(--status-dirty-bg)' }}
                            >
                              Mark Dirty
                            </button>
                          )}
                          {rm.status === 'occupied' && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Occupied by Checked-In Guest</span>
                          )}
                          {rm.status === 'out_of_order' && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--status-ooo)', fontWeight: 600 }}>Locked: Critical Maintenance</span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* MAINTENANCE TAB */}
            {activeTab === 'maintenance' && user.role !== 'housekeeping' && (
              <div className="fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem' }}>Facility Repairs & Tickets</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Log plumbing, mechanical, or room repairs.</p>
                  </div>
                  <button onClick={() => setShowTicketModal(true)} className="btn btn-primary">
                    <Plus size={16} /> Log Repair Ticket
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                  {tickets.map(t => (
                    <div key={t.id} className="glass-panel" style={{ padding: '24px', opacity: t.status === 'resolved' ? 0.6 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Room {t.room_id}</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {t.is_critical && <span className="badge badge-ooo">CRITICAL (OOO)</span>}
                          <span className={`badge badge-${t.status === 'resolved' ? 'available' : 'dirty'}`}>{t.status}</span>
                        </div>
                      </div>
                      
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '16px' }}>{t.description}</p>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>Reported: {new Date(t.created_at).toLocaleDateString()}</span>
                        {t.status !== 'resolved' && (
                          <button 
                            onClick={() => handleResolveTicket(t.id)}
                            className="btn btn-primary" 
                            style={{ padding: '4px 10px', fontSize: '0.7rem' }}
                          >
                            Mark Fixed
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FINANCE LEDGER TAB */}
            {activeTab === 'finance' && user.role !== 'housekeeping' && (
              <div className="fade-in">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '6px' }}>Active Shift Drawer Status</div>
                    {activeShift ? (
                      <div>
                        <div style={{ color: 'var(--status-available)', fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>
                          {formatCurrency(activeShift.expected_cash)}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Shift started with {formatCurrency(activeShift.starting_cash)} starting float.</span>
                      </div>
                    ) : (
                      <div>
                        <div style={{ color: 'var(--status-ooo)', fontSize: '1.4rem', fontWeight: 700, marginBottom: '6px' }}>Drawer Closed</div>
                        <button onClick={() => setShowShiftModal(true)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>Open Shift</button>
                      </div>
                    )}
                  </div>

                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '6px' }}>Total Recognized Revenue</div>
                    <div style={{ color: 'var(--gold-light)', fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>
                      {formatCurrency(transactions
                        .filter(t => t.status === 'settled' && (t.type === 'payment' || t.type === 'deposit_forfeit'))
                        .reduce((acc, curr) => acc + Number(curr.amount), 0)
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Excludes temporary active cash liabilities (deposits).</span>
                  </div>

                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '6px' }}>Active Held Liabilities</div>
                    <div style={{ color: 'var(--status-dirty)', fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>
                      {formatCurrency(
                        reservations
                          .filter(r => r.status === 'checked_in' && r.incidental_deposit_status === 'held')
                          .reduce((acc, curr) => acc + Number(curr.incidental_deposit_amount), 0)
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Active incidentals deposit cash in hand.</span>
                  </div>
                </div>

                {/* Immutable Ledger */}
                <h3 style={{ marginBottom: '16px', fontSize: '1.2rem' }}>Immutable Transaction Ledger</h3>
                <div className="glass-panel" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '16px' }}>Tx ID</th>
                        <th style={{ padding: '16px' }}>Booking Ref</th>
                        <th style={{ padding: '16px' }}>Date/Time</th>
                        <th style={{ padding: '16px' }}>Transaction Type</th>
                        <th style={{ padding: '16px' }}>Method</th>
                        <th style={{ padding: '16px', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(tx => (
                        <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                          <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{tx.id}</td>
                          <td style={{ padding: '16px', fontWeight: 600 }}>{tx.reservations?.booking_ref || 'Web Booking'}</td>
                          <td style={{ padding: '16px' }}>{new Date(tx.created_at).toLocaleString()}</td>
                          <td style={{ padding: '16px' }}>
                            <span className={`badge badge-${
                              tx.type === 'payment' || tx.type === 'deposit_forfeit' ? 'available' : (tx.type === 'deposit_hold' ? 'dirty' : 'ooo')
                            }`}>
                              {tx.type}
                            </span>
                          </td>
                          <td style={{ padding: '16px', textTransform: 'uppercase', fontSize: '0.8rem' }}>{tx.payment_method}</td>
                          <td style={{ 
                            padding: '16px', 
                            textAlign: 'right', 
                            fontWeight: 700, 
                            color: tx.type === 'refund' || tx.type === 'deposit_refund' ? 'var(--status-ooo)' : 'var(--text-primary)' 
                          }}>
                            {tx.type === 'refund' || tx.type === 'deposit_refund' ? '-' : ''}{formatCurrency(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ADMIN CONFIG TAB */}
            {activeTab === 'admin' && user.role === 'admin' && (
              <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '30px' }}>
                {/* Tax rate configuration */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', color: 'var(--gold-light)' }}>Global Hotel Settings</h3>
                  <div className="form-group">
                    <label className="form-label">Hotel Branding Name</label>
                    <input type="text" className="input-field" disabled value={settings.hotelName} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Base VAT Tax Rate (%)</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input 
                        type="number" 
                        className="input-field" 
                        value={settings.taxRate}
                        onChange={e => updateTaxRate(parseFloat(e.target.value) || 0)}
                      />
                      <button className="btn btn-primary" onClick={() => alert('Tax rate successfully updated for future reservations.')}>Update</button>
                    </div>
                  </div>
                </div>

                {/* User management (Soft delete toggle) */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '1.2rem', color: 'var(--gold-light)' }}>Internal Staff Directory</h3>
                    <button onClick={() => setShowStaffModal(true)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>Add Employee</button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {staffList.map(st => (
                      <div key={st.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'hsla(217, 32%, 10%, 0.4)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{st.first_name} {st.last_name}</div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{st.email} • <span className="badge badge-occupied" style={{ fontSize: '0.6rem', padding: '0px 6px' }}>{st.role}</span></span>
                        </div>

                        {st.id !== user.id ? (
                          <button 
                            onClick={() => handleToggleStaffStatus(st.id, st.status)}
                            className={`btn ${st.status === 'active' ? 'btn-danger' : 'btn-primary'}`}
                            style={{ padding: '4px 10px', fontSize: '0.7rem' }}
                          >
                            {st.status === 'active' ? 'Suspend' : 'Activate'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--status-available)' }}>Active Session</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </main>

      {/* WALK-IN BOOKING MODAL */}
      {showWalkInModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel fade-in" style={{ width: '100%', maxWidth: '600px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.4rem' }}>New Walk-In Reservation</h3>
              <button onClick={() => setShowWalkInModal(false)} className="btn btn-secondary" style={{ padding: '4px' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleWalkInSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input type="text" className="input-field" required value={walkInForm.firstName} onChange={e => setWalkInForm(prev => ({ ...prev, firstName: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input type="text" className="input-field" required value={walkInForm.lastName} onChange={e => setWalkInForm(prev => ({ ...prev, lastName: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Check-In Date</label>
                  <input type="date" className="input-field" value={walkInForm.checkInDate} onChange={e => setWalkInForm(prev => ({ ...prev, checkInDate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Check-Out Date</label>
                  <input type="date" className="input-field" value={walkInForm.checkOutDate} onChange={e => setWalkInForm(prev => ({ ...prev, checkOutDate: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Select Room Type *</label>
                  <select 
                    className="input-field" 
                    required 
                    value={walkInForm.roomTypeId} 
                    onChange={e => {
                      const typeId = e.target.value;
                      // Filter rooms of this type that are available
                      const matchingRooms = rooms.filter(rm => rm.room_type_id === typeId && rm.status === 'available');
                      setWalkInForm(prev => ({ ...prev, roomTypeId: typeId, roomId: matchingRooms[0]?.id || '' }));
                    }}
                  >
                    <option value="">-- Choose Category --</option>
                    {roomTypes.map(rt => (
                      <option key={rt.id} value={rt.id}>{rt.name} ({formatCurrency(rt.base_rate)}/night)</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Allocate Room *</label>
                  <select 
                    className="input-field" 
                    required 
                    value={walkInForm.roomId} 
                    onChange={e => setWalkInForm(prev => ({ ...prev, roomId: e.target.value }))}
                  >
                    <option value="">-- Choose Room --</option>
                    {rooms
                      .filter(rm => rm.room_type_id === walkInForm.roomTypeId && rm.status === 'available')
                      .map(rm => (
                        <option key={rm.id} value={rm.id}>Room {rm.id}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Payment Method *</label>
                  <select className="input-field" value={walkInForm.paymentMethod} onChange={e => setWalkInForm(prev => ({ ...prev, paymentMethod: e.target.value }))}>
                    <option value="cash">Cash (Register Drawer)</option>
                    <option value="card_terminal">POS Card Terminal</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Optional Contact Email</label>
                  <input type="email" className="input-field" placeholder="guest@mail.com" value={walkInForm.email} onChange={e => setWalkInForm(prev => ({ ...prev, email: e.target.value }))} />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }}>Confirm Walk-In Folio & Pay</button>
            </form>
          </div>
        </div>
      )}

      {/* CHECK-IN DEPOSIT MODAL */}
      {showCheckInModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel fade-in" style={{ width: '100%', maxWidth: '440px', padding: '32px' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '16px' }}>Collect Incidental Deposit</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
              Incidental holds are a mandatory operational control before room keys are issued.
            </p>

            <form onSubmit={handleCheckInSubmit}>
              <div className="form-group">
                <label className="form-label">Mandatory Hold Amount (PHP)</label>
                <input 
                  type="number" 
                  className="input-field" 
                  required 
                  value={checkInDeposit.amount}
                  onChange={e => setCheckInDeposit(prev => ({ ...prev, amount: parseInt(e.target.value) || 0 }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Deposit Type</label>
                <select 
                  className="input-field"
                  value={checkInDeposit.method}
                  onChange={e => setCheckInDeposit(prev => ({ ...prev, method: e.target.value }))}
                >
                  <option value="cash">Physical Cash Cashier</option>
                  <option value="card_auth">Credit Card Hold authorization</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowCheckInModal(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Complete Check-In</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHECK-OUT RESOLVE MODAL */}
      {showCheckOutModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel fade-in" style={{ width: '100%', maxWidth: '480px', padding: '32px' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '12px' }}>Process Guest Check-Out</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Resolve the incidental deposit hold of <strong>{formatCurrency(showCheckOutModal.incidental_deposit_amount)}</strong> ({showCheckOutModal.incidental_deposit_method}).
            </p>

            <form onSubmit={handleCheckOutSubmit}>
              <div className="form-group">
                <label className="form-label">Deposit Resolution</label>
                <select 
                  className="input-field" 
                  value={checkOutResolution}
                  onChange={e => setCheckOutResolution(e.target.value as any)}
                >
                  <option value="refund">Refund Deposit In Full</option>
                  <option value="forfeit_full">Forfeit Full Deposit (Severe damage)</option>
                  <option value="forfeit_partial">Forfeit Partial Deposit</option>
                </select>
              </div>

              {checkOutResolution === 'forfeit_partial' && (
                <div className="form-group">
                  <label className="form-label">Forfeit Amount (PHP)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    max={showCheckOutModal.incidental_deposit_amount}
                    min={0}
                    value={checkOutForfeitAmount}
                    onChange={e => setCheckOutForfeitAmount(parseInt(e.target.value) || 0)}
                  />
                  <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Refunded amount: {formatCurrency(showCheckOutModal.incidental_deposit_amount - checkOutForfeitAmount)}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowCheckOutModal(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-danger" style={{ flex: 2 }}>Complete Check-Out</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW MAINTENANCE TICKET MODAL */}
      {showTicketModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel fade-in" style={{ width: '100%', maxWidth: '440px', padding: '32px' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '20px' }}>Log Maintenance Ticket</h3>

            <form onSubmit={handleTicketSubmit}>
              <div className="form-group">
                <label className="form-label">Select Room</label>
                <select 
                  className="input-field" 
                  required
                  value={newTicket.roomId}
                  onChange={e => setNewTicket(prev => ({ ...prev, roomId: e.target.value }))}
                >
                  <option value="">-- Choose Room --</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>Room {r.id} ({r.status})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Issue Details</label>
                <textarea 
                  className="input-field" 
                  required 
                  rows={3} 
                  value={newTicket.description}
                  onChange={e => setNewTicket(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '18px 0' }}>
                <input 
                  type="checkbox" 
                  id="critChk" 
                  checked={newTicket.isCritical}
                  onChange={e => setNewTicket(prev => ({ ...prev, isCritical: e.target.checked }))}
                />
                <label htmlFor="critChk" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <strong>Critical issue:</strong> Take room Out of Order immediately.
                </label>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowTicketModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Submit Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHIFT OPENING MODAL */}
      {showShiftModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel fade-in" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '16px' }}>Open Cash Drawer Shift</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Enter the starting cashier float inside the drawer. This is required before starting bookings.
            </p>

            <form onSubmit={handleStartShift}>
              <div className="form-group">
                <label className="form-label">Starting Cash Float (PHP)</label>
                <input 
                  type="number" 
                  className="input-field" 
                  required 
                  value={startingCashInput}
                  onChange={e => setStartingCashInput(parseInt(e.target.value) || 0)}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowShiftModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Start Cash Shift</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHIFT CLOSING RECONCILIATION MODAL */}
      {showCloseShiftModal && activeShift && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel fade-in" style={{ width: '100%', maxWidth: '440px', padding: '32px' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>End-of-Shift Cash Count</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Perform a blind count of the cash in drawer and enter the exact total.
            </p>

            {reconError && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--status-ooo)', borderRadius: '8px', color: 'var(--status-ooo)', marginBottom: '16px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={18} />
                  <strong>Reconciliation Error</strong>
                </div>
                <span>{reconError}</span>
              </div>
            )}

            <form onSubmit={handleCloseShift}>
              <div className="form-group">
                <label className="form-label">Physical Cash Drawer Count (PHP)</label>
                <input 
                  type="number" 
                  className="input-field" 
                  required
                  value={actualCashInput}
                  onChange={e => setActualCashInput(parseInt(e.target.value) || 0)}
                />
              </div>

              {reconNeedsOverride && (
                <div className="form-group fade-in">
                  <label className="form-label">Admin Pin Authorization Override</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    placeholder="••••"
                    value={adminPINInput}
                    onChange={e => setAdminPINInput(e.target.value)}
                  />
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Admin overrides are logged permanently inside the security audit trails. (Use any key to bypass for demo).
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                <button type="button" onClick={() => { setShowCloseShiftModal(false); setReconError(null); setReconNeedsOverride(false); }} className="btn btn-secondary" style={{ flex: 1 }}>Back</button>
                <button type="submit" className="btn btn-danger" style={{ flex: 2 }}>
                  {reconNeedsOverride ? 'Authorize & Force Close' : 'Verify Drawer Count'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW EMPLOYEE STAFF MODAL */}
      {showStaffModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel fade-in" style={{ width: '100%', maxWidth: '440px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.4rem' }}>Provision Staff Credentials</h3>
              <button onClick={() => setShowStaffModal(false)} className="btn btn-secondary" style={{ padding: '4px' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleStaffSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input type="text" className="input-field" required value={newStaff.firstName} onChange={e => setNewStaff(prev => ({ ...prev, firstName: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input type="text" className="input-field" required value={newStaff.lastName} onChange={e => setNewStaff(prev => ({ ...prev, lastName: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input type="email" className="input-field" required placeholder="name@hos.com" value={newStaff.email} onChange={e => setNewStaff(prev => ({ ...prev, email: e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="form-label">Role Definition</label>
                <select 
                  className="input-field"
                  value={newStaff.role}
                  onChange={e => setNewStaff(prev => ({ ...prev, role: e.target.value as any }))}
                >
                  <option value="front_desk">Front Desk Agent</option>
                  <option value="housekeeping">Housekeeping Operations</option>
                  <option value="admin">System Administrator</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }}>Generate Staff Account</button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Storefront switch */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 99 }}>
        <button onClick={onGoToStorefront} className="btn btn-secondary" style={{ backgroundColor: 'var(--bg-primary)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-light)' }}>
          Public Web Storefront
        </button>
      </div>
    </div>
  );
};
