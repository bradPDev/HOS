import React, { useState, useEffect } from 'react';
import { useStore } from '../store/store';
import type { RoomType } from '../store/store';
import { supabase } from '../lib/supabaseClient';
import { Calendar, Users, CreditCard, Wifi, Coffee, MapPin, CheckCircle, AlertTriangle, ArrowRight, ShieldCheck, Mail, Phone, User, Sparkles } from 'lucide-react';

interface WebStorefrontProps {
  onGoToStaffPortal: () => void;
}

export const WebStorefront: React.FC<WebStorefrontProps> = ({ onGoToStaffPortal }) => {
  const { cart, setCartDates, selectRoomType, resetCart } = useStore();
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [availableRoomsCount, setAvailableRoomsCount] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Checkout Wizard States
  const [step, setStep] = useState<'search' | 'details' | 'payment' | 'success'>('search');
  const [guestDetails, setGuestDetails] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    specialRequests: ''
  });
  
  // Payment states
  const [cardDetails, setCardDetails] = useState({ number: '', expiry: '', cvc: '' });
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [createdReservation, setCreatedReservation] = useState<any>(null);
  
  // Hold timer states
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Fetch Room Types
  useEffect(() => {
    const fetchRoomTypes = async () => {
      const { data } = await supabase.from('room_types').select('*');
      if (data) setRoomTypes(data);
    };
    fetchRoomTypes();
  }, []);

  // 10-Minute Cart Lock Countdown Timer
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      handleHoldExpiration();
      return;
    }
    const interval = setInterval(() => {
      setTimeLeft(prev => (prev ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const handleHoldExpiration = async () => {
    if (createdReservation) {
      // Abandon hold on server
      await supabase
        .from('reservations')
        .update({ status: 'abandoned', payment_status: 'unpaid' })
        .eq('id', createdReservation.id);
      
      // Update room status back if held
      if (createdReservation.room_id) {
        await supabase
          .from('rooms')
          .update({ status: 'available' })
          .eq('id', createdReservation.room_id);
      }
    }
    setStep('search');
    setTimeLeft(null);
    setCreatedReservation(null);
    alert('Your 10-minute hold has expired. The room has been released.');
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart.checkInDate || !cart.checkOutDate) {
      alert('Please select both Check-In and Check-Out dates.');
      return;
    }
    
    const checkIn = new Date(cart.checkInDate);
    const checkOut = new Date(cart.checkOutDate);
    
    if (checkIn < new Date(new Date().setHours(0, 0, 0, 0))) {
      alert('Check-In date cannot be in the past.');
      return;
    }
    if (checkOut <= checkIn) {
      alert('Check-Out date must be after Check-In date.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch all active/confirmed/checked_in reservations that overlap
      const { data: overlappingBookings } = await supabase
        .from('reservations')
        .select('*')
        .neq('status', 'canceled')
        .neq('status', 'abandoned');

      const overlaps = (overlappingBookings || []).filter((b: any) => {
        return (
          b.check_in_date < cart.checkOutDate && 
          b.check_out_date > cart.checkInDate
        );
      });

      // Group overlaps by physical room
      const busyRoomIds = overlaps.map((b: any) => b.room_id).filter(Boolean);

      // 2. Fetch all physical rooms that are NOT Out of Order
      const { data: rooms } = await supabase
        .from('rooms')
        .select('*')
        .neq('status', 'out_of_order');

      // Filter out busy rooms
      const availableRooms = (rooms || []).filter((r: any) => !busyRoomIds.includes(r.id));

      // Calculate availability count grouped by room_type_id
      const counts: Record<string, number> = {};
      availableRooms.forEach((r: any) => {
        counts[r.room_type_id] = (counts[r.room_type_id] || 0) + 1;
      });

      setAvailableRoomsCount(counts);
      setHasSearched(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRoom = async (roomTypeId: string) => {
    selectRoomType(roomTypeId);
    setStep('details');
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestDetails.firstName || !guestDetails.lastName || !guestDetails.email || !guestDetails.phone) {
      alert('Please fill out all required fields.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Double check availability and assign a room
      const { data: overlappingBookings } = await supabase
        .from('reservations')
        .select('*')
        .neq('status', 'canceled')
        .neq('status', 'abandoned');

      const busyRoomIds = (overlappingBookings || [])
        .filter((b: any) => b.check_in_date < cart.checkOutDate && b.check_out_date > cart.checkInDate)
        .map((b: any) => b.room_id)
        .filter(Boolean);

      const { data: rooms } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_type_id', cart.selectedRoomTypeId)
        .neq('status', 'out_of_order');

      // Find first available room of this type
      const targetRoom = (rooms || []).find((r: any) => !busyRoomIds.includes(r.id));

      if (!targetRoom) {
        alert('We apologize, but this room type just became unavailable for your dates.');
        setStep('search');
        return;
      }

      // Generate unique Alphanumeric Booking Ref
      const bookingRef = 'HOS-' + Math.random().toString(36).substring(2, 7).toUpperCase();
      const holdExpires = new Date(Date.now() + 10 * 60000); // 10 mins hold

      // Create pending reservation
      const { data: reservation, error } = await supabase
        .from('reservations')
        .insert({
          booking_ref: bookingRef,
          guest_first_name: guestDetails.firstName,
          guest_last_name: guestDetails.lastName,
          guest_email: guestDetails.email,
          guest_phone: guestDetails.phone,
          check_in_date: cart.checkInDate,
          check_out_date: cart.checkOutDate,
          room_type_id: cart.selectedRoomTypeId,
          room_id: targetRoom.id,
          status: 'pending',
          payment_status: 'unpaid',
          special_requests: guestDetails.specialRequests,
          hold_expires_at: holdExpires.toISOString()
        })
        .select();

      if (error || !reservation) throw error || new Error('Failed to lock reservation');

      // Temporarily mark room status as dirty or keep available (we keep it reserved by reservation overlapping check)
      setCreatedReservation(reservation[0]);
      setTimeLeft(600); // 10 minutes in seconds
      setStep('payment');
    } catch (err) {
      console.error(err);
      alert('Error booking reservation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardDetails.number || !cardDetails.expiry || !cardDetails.cvc) {
      setPaymentError('Please fill out card details.');
      return;
    }
    setPaymentError(null);
    setIsProcessingPayment(true);

    // Simulate payment transaction
    setTimeout(async () => {
      try {
        // Capture transaction
        const { error: txError } = await supabase
          .from('financial_transactions')
          .insert({
            reservation_id: createdReservation.id,
            amount: calculateTotal(selectedRoomTypeDetail!.base_rate),
            type: 'payment',
            payment_method: 'online',
            status: 'settled'
          })
          .select();

        if (txError) throw txError;

        // Update reservation to confirmed
        const { error: resError } = await supabase
          .from('reservations')
          .update({
            status: 'confirmed',
            payment_status: 'captured',
            payment_method: 'online',
            hold_expires_at: null
          })
          .eq('id', createdReservation.id);

        if (resError) throw resError;

        setStep('success');
        setTimeLeft(null); // Stop timer
      } catch (err) {
        console.error(err);
        setPaymentError('Payment transaction failed. Please retry.');
      } finally {
        setIsProcessingPayment(false);
      }
    }, 1500);
  };

  // Helper selectors
  const selectedRoomTypeDetail = roomTypes.find(rt => rt.id === cart.selectedRoomTypeId);
  
  const calculateNights = () => {
    if (!cart.checkInDate || !cart.checkOutDate) return 0;
    const diff = new Date(cart.checkOutDate).getTime() - new Date(cart.checkInDate).getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
  };

  const calculateSubtotal = (baseRate: number) => {
    return baseRate * calculateNights();
  };

  const calculateTotal = (baseRate: number) => {
    const sub = calculateSubtotal(baseRate);
    return Number((sub * 1.12).toFixed(2)); // 12% standard VAT
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val);
  };

  return (
    <div className="fade-in" style={{ paddingBottom: '60px' }}>
      {/* Hero Banner */}
      {step === 'search' && (
        <section style={{
          position: 'relative',
          padding: '120px 40px 100px',
          textAlign: 'center',
          background: 'linear-gradient(rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.9)), url("https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1600&q=80")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRadius: '0 0 32px 32px',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center', color: 'var(--gold-light)', marginBottom: '16px' }}>
            <Sparkles size={20} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.85rem' }}>Bespoke Hospitality</span>
          </div>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', lineHeight: '1.2' }}>
            Experience Luxury <span style={{ color: 'var(--gold-light)' }}>Redefined</span>
          </h1>
          <p style={{ maxWidth: '600px', margin: '0 auto 40px', color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
            Nestled in the heart of Manila, HOS Grand Plaza merges historic elegance with modern state-of-the-art hospitality.
          </p>

          {/* Quick Stats / Highlights */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap', marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <Wifi size={18} className="gold-text" style={{ color: 'var(--gold-light)' }} />
              <span>Complimentary Ultra-Speed Wi-Fi</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <Coffee size={18} style={{ color: 'var(--gold-light)' }} />
              <span>Artisanal Daily Breakfast</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <MapPin size={18} style={{ color: 'var(--gold-light)' }} />
              <span>Prime Heritage District Location</span>
            </div>
          </div>

          {/* Availability Widget */}
          <div className="glass-panel" style={{ maxWidth: '900px', margin: '0 auto', padding: '24px', position: 'relative', zIndex: 10 }}>
            <form onSubmit={handleSearch} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
              <div className="form-group" style={{ margin: 0, textAlign: 'left' }}>
                <label className="form-label"><Calendar size={14} style={{ marginRight: '4px' }} /> Check-In</label>
                <input
                  type="date"
                  className="input-field"
                  value={cart.checkInDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setCartDates(e.target.value, cart.checkOutDate, cart.guestsCount)}
                  required
                />
              </div>
              <div className="form-group" style={{ margin: 0, textAlign: 'left' }}>
                <label className="form-label"><Calendar size={14} style={{ marginRight: '4px' }} /> Check-Out</label>
                <input
                  type="date"
                  className="input-field"
                  value={cart.checkOutDate}
                  min={cart.checkInDate || new Date().toISOString().split('T')[0]}
                  onChange={e => setCartDates(cart.checkInDate, e.target.value, cart.guestsCount)}
                  required
                />
              </div>
              <div className="form-group" style={{ margin: 0, textAlign: 'left' }}>
                <label className="form-label"><Users size={14} style={{ marginRight: '4px' }} /> Guests</label>
                <select
                  className="input-field"
                  value={cart.guestsCount}
                  onChange={e => setCartDates(cart.checkInDate, cart.checkOutDate, parseInt(e.target.value))}
                >
                  <option value={1}>1 Guest</option>
                  <option value={2}>2 Guests</option>
                  <option value={3}>3 Guests</option>
                  <option value={4}>4 Guests</option>
                  <option value={6}>6 Guests</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ height: '48px', width: '100%' }} disabled={isLoading}>
                {isLoading ? 'Checking...' : 'Check Availability'}
              </button>
            </form>
          </div>
        </section>
      )}

      {/* Main Container */}
      <main style={{ maxWidth: '1200px', margin: '40px auto', padding: '0 20px' }}>
        
        {/* Search & Selection Page */}
        {step === 'search' && (
          <div>
            {!hasSearched ? (
              // Default Room Catalog display
              <div>
                <h2 style={{ textAlign: 'center', marginBottom: '32px', fontSize: '2rem' }}>Our Curated Accommodations</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '30px' }}>
                  {roomTypes.map(rt => (
                    <div key={rt.id} className="glass-panel glass-panel-interactive" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ height: '240px', overflow: 'hidden', position: 'relative' }}>
                        <img src={rt.image_url} alt={rt.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(15, 23, 42, 0.85)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                          <span style={{ color: 'var(--gold-light)', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                            {formatCurrency(rt.base_rate)}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>/night</span>
                        </div>
                      </div>
                      <div style={{ padding: '24px', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ fontSize: '1.4rem', marginBottom: '12px' }}>{rt.name}</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px', flexGrow: 1 }}>{rt.description}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Users size={16} /> Max Capacity: {rt.max_capacity} Adults
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Search Results Display
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.8rem' }}>Available Rooms</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      Showing rooms from {cart.checkInDate} to {cart.checkOutDate} for {cart.guestsCount} guests.
                    </p>
                  </div>
                  <button onClick={() => setHasSearched(false)} className="btn btn-secondary">Clear Search</button>
                </div>

                <div style={{ display: 'grid', gridTemplateRows: 'auto', gap: '24px' }}>
                  {roomTypes.map(rt => {
                    const count = availableRoomsCount[rt.id] || 0;
                    const nights = calculateNights();
                    const totalCost = calculateTotal(rt.base_rate);
                    const isCapacityOk = rt.max_capacity >= cart.guestsCount;

                    return (
                      <div key={rt.id} className="glass-panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', overflow: 'hidden', opacity: (!isCapacityOk || count === 0) ? 0.6 : 1 }}>
                        <div style={{ height: '220px', overflow: 'hidden' }}>
                          <img src={rt.image_url} alt={rt.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <h3 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>{rt.name}</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '12px' }}>{rt.description}</p>
                          </div>
                          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Users size={14} /> Max Capacity: {rt.max_capacity}
                            </span>
                            <span style={{ fontSize: '0.8rem', color: count > 0 ? 'var(--status-available)' : 'var(--status-ooo)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle size={14} /> {count > 0 ? `${count} Rooms Left` : 'Sold Out'}
                            </span>
                          </div>
                        </div>
                        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'md-end', borderLeft: '1px solid var(--border-color)', textAlign: 'right', background: 'hsla(217, 32%, 10%, 0.2)' }}>
                          <div style={{ marginBottom: '16px' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nightly Rate: </span>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>{formatCurrency(rt.base_rate)}</strong>
                          </div>
                          <div style={{ marginBottom: '20px' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total ({nights} nights incl. tax):</span>
                            <div style={{ color: 'var(--gold-light)', fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>{formatCurrency(totalCost)}</div>
                          </div>
                          
                          {!isCapacityOk ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--status-ooo)', justifyContent: 'flex-end', fontSize: '0.85rem' }}>
                              <AlertTriangle size={14} /> Exceeds Max Capacity
                            </div>
                          ) : count > 0 ? (
                            <button onClick={() => handleSelectRoom(rt.id)} className="btn btn-primary" style={{ width: '100%' }}>
                              Book Room <ArrowRight size={16} />
                            </button>
                          ) : (
                            <button className="btn btn-secondary" style={{ width: '100%' }} disabled>Unavailable</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Guest Details Form Step */}
        {step === 'details' && selectedRoomTypeDetail && (
          <div className="glass-panel fade-in" style={{ maxWidth: '600px', margin: '0 auto', padding: '32px' }}>
            <h2 style={{ fontSize: '1.6rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User style={{ color: 'var(--gold-light)' }} /> Guest Information
            </h2>
            <form onSubmit={handleDetailsSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input
                    type="text"
                    className="input-field"
                    required
                    value={guestDetails.firstName}
                    onChange={e => setGuestDetails(prev => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input
                    type="text"
                    className="input-field"
                    required
                    value={guestDetails.lastName}
                    onChange={e => setGuestDetails(prev => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label"><Mail size={14} style={{ marginRight: '4px' }} /> Email Address *</label>
                <input
                  type="email"
                  className="input-field"
                  required
                  value={guestDetails.email}
                  onChange={e => setGuestDetails(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label"><Phone size={14} style={{ marginRight: '4px' }} /> Mobile Number *</label>
                <input
                  type="tel"
                  className="input-field"
                  required
                  placeholder="+63 9xx xxx xxxx"
                  value={guestDetails.phone}
                  onChange={e => setGuestDetails(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Special Requests (Optional)</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={guestDetails.specialRequests}
                  onChange={e => setGuestDetails(prev => ({ ...prev, specialRequests: e.target.value }))}
                />
              </div>

              {/* Order breakdown */}
              <div style={{ padding: '16px', background: 'hsla(217, 32%, 10%, 0.4)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                <h4 style={{ marginBottom: '10px', color: 'var(--gold-light)' }}>Stay Summary</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  <span>{selectedRoomTypeDetail.name} ({calculateNights()} nights)</span>
                  <span>{formatCurrency(calculateSubtotal(selectedRoomTypeDetail.base_rate))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  <span>VAT & Local Taxes (12%)</span>
                  <span>{formatCurrency(calculateSubtotal(selectedRoomTypeDetail.base_rate) * 0.12)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                  <span>Grand Total</span>
                  <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(calculateTotal(selectedRoomTypeDetail.base_rate))}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <button type="button" onClick={() => setStep('search')} className="btn btn-secondary" style={{ flex: 1 }}>Back</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={isLoading}>
                  {isLoading ? 'Reserving...' : 'Proceed to Payment'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Secure Checkout / Payment Simulation */}
        {step === 'payment' && selectedRoomTypeDetail && (
          <div className="glass-panel fade-in" style={{ maxWidth: '600px', margin: '0 auto', padding: '32px' }}>
            {/* Hold Timer Banner */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: 'hsla(38, 92%, 50%, 0.1)', border: '1px solid var(--status-dirty)', borderRadius: '8px', marginBottom: '24px', color: 'var(--status-dirty)' }}>
              <ClockBlinking />
              <div style={{ fontSize: '0.9rem' }}>
                Inventory Locked: Room is held for <strong>{Math.floor(timeLeft! / 60)}:{(timeLeft! % 60).toString().padStart(2, '0')}</strong>. Complete your transaction before the hold expires.
              </div>
            </div>

            <h2 style={{ fontSize: '1.6rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard style={{ color: 'var(--gold-light)' }} /> Secure Payment Terminal
            </h2>

            {paymentError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--status-ooo)', borderRadius: '6px', color: 'var(--status-ooo)', marginBottom: '16px' }}>
                <AlertTriangle size={18} />
                <span>{paymentError}</span>
              </div>
            )}

            <form onSubmit={handlePaymentSubmit}>
              <div className="form-group">
                <label className="form-label">Cardholder Name</label>
                <input
                  type="text"
                  className="input-field"
                  required
                  placeholder={`${guestDetails.firstName} ${guestDetails.lastName}`}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Credit Card Number</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="input-field"
                    required
                    maxLength={19}
                    placeholder="4000 1234 5678 9010"
                    value={cardDetails.number}
                    onChange={e => setCardDetails(prev => ({ ...prev, number: e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim() }))}
                  />
                  <CreditCard size={18} style={{ position: 'absolute', right: '16px', top: '14px', color: 'var(--text-muted)' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Expiration Date</label>
                  <input
                    type="text"
                    className="input-field"
                    required
                    placeholder="MM/YY"
                    maxLength={5}
                    value={cardDetails.expiry}
                    onChange={e => setCardDetails(prev => ({ ...prev, expiry: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">CVC / Security Code</label>
                  <input
                    type="password"
                    className="input-field"
                    required
                    maxLength={4}
                    placeholder="***"
                    value={cardDetails.cvc}
                    onChange={e => setCardDetails(prev => ({ ...prev, cvc: e.target.value }))}
                  />
                </div>
              </div>

              {/* Total review */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'hsla(217, 32%, 10%, 0.4)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Amount to Pay:</span>
                <strong style={{ color: 'var(--gold-light)', fontSize: '1.4rem' }}>
                  {formatCurrency(calculateTotal(selectedRoomTypeDetail.base_rate))}
                </strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px', justifyContent: 'center' }}>
                <ShieldCheck size={16} style={{ color: 'var(--status-available)' }} /> 
                <span>Stripe Encrypted Sandbox. No real charges are made.</span>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <button type="button" onClick={handleHoldExpiration} className="btn btn-secondary" style={{ flex: 1 }}>Cancel Booking</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={isProcessingPayment}>
                  {isProcessingPayment ? 'Authorizing Card...' : 'Confirm & Pay'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Success / Receipt Screen */}
        {step === 'success' && selectedRoomTypeDetail && createdReservation && (
          <div className="glass-panel fade-in" style={{ maxWidth: '600px', margin: '0 auto', padding: '40px', textAlign: 'center' }}>
            <CheckCircle size={60} style={{ color: 'var(--status-available)', marginBottom: '20px' }} />
            <h2 style={{ fontSize: '2rem', color: 'var(--text-primary)', marginBottom: '8px' }}>Reservation Confirmed</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
              We have processed your payment and allocated your luxury suite. An automated receipt has been sent to <strong>{guestDetails.email}</strong>.
            </p>

            <div style={{ backgroundColor: 'hsla(224, 71%, 2%, 0.8)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', textAlign: 'left', marginBottom: '32px', fontFamily: 'var(--font-body)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Booking Reference:</span>
                <strong style={{ color: 'var(--gold-light)', fontSize: '1.1rem', letterSpacing: '0.05em' }}>{createdReservation.booking_ref}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Guest Name:</span>
                <span>{guestDetails.firstName} {guestDetails.lastName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Accomodation:</span>
                <span>{selectedRoomTypeDetail.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Assigned Room:</span>
                <span>Room {createdReservation.room_id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Check-In:</span>
                <span>{createdReservation.check_in_date} (from 2:00 PM)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Check-Out:</span>
                <span>{createdReservation.check_out_date} (before 12:00 PM)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Total Pre-Paid:</strong>
                <strong style={{ color: 'var(--gold-light)' }}>{formatCurrency(calculateTotal(selectedRoomTypeDetail.base_rate))}</strong>
              </div>
            </div>

            <div style={{ padding: '16px', background: 'hsla(217, 32%, 15%, 0.4)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'left', marginBottom: '32px' }}>
              <strong>Notice:</strong> An Incidental Deposit of <strong>1,000.00 PHP</strong> is required physically at the front desk upon check-in. This will be fully refunded at check-out pending room inspection.
            </div>

            <button onClick={() => { resetCart(); setStep('search'); setCreatedReservation(null); }} className="btn btn-primary" style={{ width: '100%' }}>
              Return to Homepage
            </button>
          </div>
        )}
      </main>

      {/* Floating admin portal switch */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 99 }}>
        <button onClick={onGoToStaffPortal} className="btn btn-secondary" style={{ backgroundColor: 'var(--bg-primary)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-light)' }}>
          Staff Dashboard Portal
        </button>
      </div>
    </div>
  );
};

// Blinking Clock SVG Component for Hold Timer
const ClockBlinking: React.FC = () => {
  return (
    <svg className="clock-pulse" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'pulse 1.5s infinite' }}>
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
      `}</style>
    </svg>
  );
};
