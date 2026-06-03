# Hotel Management System Documentation

## Project Scope Document: Hotel Management System (MVP)
**Document Version:** 2.1 (Revised: Incidental Deposits Added)  
**Date:** June 1, 2026  
**Prepared By:** Bradley Mosuela, Project Manager  

### 1. Project Overview
This document outlines the Minimum Viable Product (MVP) scope for the Hotel Management System. The objective is to establish a scalable digital foundation that enables seamless online guest bookings while providing comprehensive, modular back-office controls. This release ensures full operational continuity, supporting both online guests and physical front-desk operations, including walk-ins, physical payment handling, and liability tracking.

### 2. Target User Roles
Based on Role-Based Access Control (RBAC), the system accommodates the following distinct user profiles:
* **Guest (Public):** Unauthenticated users browsing the storefront, checking availability, and booking online.
* **Front Desk Staff:** Authenticated users managing manual reservations, check-ins, check-outs, incidental deposits, and cash transactions.
* **Housekeeping & Maintenance:** Authenticated users monitoring room statuses and logging repair tasks.
* **System Administrator (Super Admin):** Authenticated users managing system configurations, room inventory, global ledgers, and staff permissions.

### 3. Core Feature Breakdown (Modular Architecture)
#### Module 1: Web Storefront & Catalog
* **Homepage & Basic Details:** A responsive landing page featuring branding, hero banner, location, contact info, standard policies, and basic amenities.
* **Room Catalog:** Dynamic listings displaying available room types, images, descriptions, capacities, and nightly rates.
* **Availability Calendar:** Interactive calendar allowing guests to input dates and view real-time room availability.

#### Module 2: Guest Booking & Payment Engine
* **Online Reservation Process:** Step-by-step booking form capturing essential guest details (Name, Email, Phone, Special Requests).
* **Payment Gateway Integration:** Secure online payment processing for credit/debit cards and digital wallets.
* **Booking Summary & Confirmation:** Final cost breakdown interface and automated, system-generated email receipts containing booking reference and check-in instructions.

#### Module 3: Front Desk & Reservation Management
* **Centralized Reservation Ledger:** Interface to view, modify, approve, or cancel all upcoming, active, and past bookings.
* **Walk-In & Manual Booking Flow:** Dedicated interface for Front Desk staff to manually create reservations, bypass online payment gateways, and allocate specific rooms on the spot.
* **Check-In/Check-Out Processing:** System triggers to transition booking states (e.g., Confirmed -> Checked-In -> Checked-Out), including the mandatory collection, tracking, and refunding of Incidental Deposits (Cash/Card Holds).

#### Module 4: Inventory & Maintenance Operations
* **Room Inventory Management:** Admin interface to add, edit, or disable physical rooms and update base pricing/descriptions.
* **Housekeeping Status Lifecycle:** Real-time dashboard for room statuses. Strict Status Flow: Available -> Occupied -> Checked-Out (Dirty) -> Cleaning -> Inspected/Available.
* **Maintenance Task Logging:** Capability to log specific room issues (e.g., "Broken AC") and flag the room as "Out of Order."
* **Availability Sync:** Hard constraint ensuring rooms marked as "Dirty" or "Out of Order" cannot be allocated to new bookings.

#### Module 5: Financial Ledger Module
* **Digital Payment Ledger:** Tracking module for online payments, transaction statuses (successful, pending, failed), and digital refunds.
* **Cash/Physical Ledger:** Tracking module for Front Desk to record offline payments (cash, physical credit terminal) and explicitly track temporary liabilities (Incidental Deposits) separate from recognized revenue. Ensures perfectly balanced end-of-shift drawer reconciliation.

#### Module 6: System Administration & Security
* **Staff RBAC:** Access control matrix allowing System Administrators to create staff accounts, reset passwords, and assign specific role-based permissions (Front Desk vs. Housekeeping).

### 4. Out of Scope for MVP (Future Sprints)
* Advanced loyalty programs or point systems.
* Integration with third-party Online Travel Agencies (OTAs like Agoda or Booking.com).
* In-app chat support or advanced CRM/marketing features.
* Advanced Accounting Features (e.g., General Ledger integration, payroll, vendor management).

---

## Module 1: Web Storefront & Catalog
**Document Status:** Draft for Review  
**Module Owner:** Marketing & Guest Relations  
**Prepared By:** Bradley Mosuela, Project Manager  

### 1. Overview
The Web Storefront & Catalog module serves as the digital face of the hotel. It provides an optimized, responsive user experience for public guests to explore the property, view amenities, and search for room availability. It acts as the top of the sales funnel, driving traffic directly into the Guest Booking Engine (Module 2).

### 2. Scope and Limitations
**In-Scope (MVP):**
* Responsive landing page (Hero banner, hotel information, location map).
* Static content pages (Contact Us, Terms & Conditions, Privacy Policy).
* Room catalog displaying high-resolution images, descriptions, and baseline rates.
* Interactive date-picker widget for checking availability.

**Out of Scope (MVP):**
* Dynamic content management system (CMS) for blogging.
* Multi-language translation toggles.
* User accounts for guests (All bookings are "Guest Checkout" for MVP).

### 3. User Roles and Responsibilities
* **Guest (Public):** Unauthenticated users. Authorized to view all public-facing content and query the availability calendar.
* **System (Automated):** Responsible for serving cached content rapidly and passing search parameters securely to Module 2.

### 4. Business Logic and Rules
* **The Caching Mandate:** To protect system resources, static room details (images, descriptions, standard capacities) must be served via a Content Delivery Network (CDN) or application-level cache.
* **Live Availability Query:** The system will only execute a heavy database query against the live inventory (Module 4) when the user inputs specific Check-In/Check-Out dates and clicks the "Search" button.
* **Rate Transparency:** The nightly rate displayed in the general catalog is the "Starting At" base rate. The system must clearly indicate this (e.g., "From $99/night") to account for date-based dynamic pricing that may apply upon search.

### 5. Process Flow
**Process A: Searching for Room Availability**
* **Action:** Navigate to the Homepage and locate the Availability Widget.
* **Action:** Select a Check-In Date and Check-Out Date from the interactive calendar.
* **Action:** Enter the number of Guests (Adults/Children) and click [Check Availability].
* **Result:** The system queries Module 4 (Inventory), filtering out rooms marked Occupied, Dirty, or Out of Order for the requested date range.
* **Action:** System renders the Search Results page.
* **Result:** Only room types with at least one physical room available for the entire duration are displayed, showing the accurately calculated total price.
* **Action:** Click [Book Now] on a specific room type.
* **Result:** The system passes the date and room parameters to Module 2 (Booking Engine) and routes the user into the checkout flow.

### 6. Status Flow
While the storefront does not maintain complex state machines, it reacts to the state of the Inventory (Module 4):
* **Available:** The room type is displayed with a "Book Now" CTA.
* **Sold Out:** The room type is displayed, but the CTA is disabled and reads "Unavailable for Selected Dates."

### 7. Inputs and Outputs
* **Inputs Required:** Check-in Date, Check-out Date, Guest Count.
* **Outputs Generated:** Filtered array of available room objects, calculated price totals.

### 8. Constraints and Edge Cases
* **Edge Case: Past Dates.** The date-picker widget must strictly disable the selection of past dates or a check-out date that chronologically precedes the check-in date.
* **Constraint: Mobile Responsiveness.** Over 60% of hotel browsing occurs on mobile devices. The UI must stack gracefully, and the date-picker must be touch-friendly (avoiding complex desktop-only hover states).

### 9. Integration
* **Module 4 (Inventory):** Reads master room data and base pricing for catalog generation.
* **Module 2 (Booking Engine):** Handoff point; passes user intent and selected dates directly into the checkout wizard.

---

## Module 2: Guest Booking & Payment Engine
**Document Status:** Draft for Review  
**Module Owner:** E-Commerce & Revenue Strategy  
**Prepared By:** Bradley Mosuela, Project Manager  

### 1. Overview
The Guest Booking & Payment Engine is the primary public-facing revenue generation module. It handles the secure transition of a website visitor into a paying guest. This module manages the date selection, data capture, secure payment gateway transaction, and the generation of automated booking confirmations.

### 2. Scope and Limitations
**In-Scope (MVP):**
* Step-by-step checkout wizard for single-room bookings.
* Capture of primary guest Personal Identifiable Information (PII).
* Integration with a secure third-party payment gateway (e.g., Stripe, PayPal) for credit/debit transactions.
* Automated email dispatch for receipts and booking confirmations.

**Out of Scope (MVP):**
* Multi-room group bookings in a single checkout flow (guests must make separate bookings for MVP).
* Promo code/discount engine.
* Dynamic pricing algorithms based on demand (rates are statically pulled from Module 4).

### 3. User Roles and Responsibilities
* **Guest (Public):** Unauthenticated end-user. Responsible for providing accurate contact and payment information.
* **System (Automated):** Responsible for executing validations, locking inventory, communicating with the payment gateway, and dispatching emails.
* **Prerequisite:** Guests must possess a valid email address and a supported digital payment method to complete the online flow.

### 4. Business Logic and Rules
* **The Inventory Hold Rule (Cart Lock):** When a guest selects a room and enters the checkout flow, the system must temporarily lock that specific room for a maximum of 10 minutes. If payment is not captured within this window, the lock expires, and the room returns to the public Available pool.
* **100% Prepayment Mandate:** For the online MVP, to minimize no-show risks, reservations require 100% payment of the room rate at the time of booking. (Note: Incidental deposits are handled physically at the Front Desk).
* **No Double-Booking:** The system must perform a final availability check against Module 4 (Inventory) immediately before executing the payment charge, ensuring the room wasn't booked offline by the Front Desk during the guest's session.

### 5. Process Flow
**Process A: Executing an Online Booking**
* **Action:** Navigate to the Room Catalog, enter desired Check-In/Check-Out dates, and click [Check Availability].
* **Result:** The system queries Module 4 and displays only available room types for those specific dates.
* **Action:** Click [Book Now] on the preferred room type.
* **Result:** The 10-minute Inventory Hold timer begins. The system routes the user to the Guest Details Form.
* **Action:** Enter required fields: First Name, Last Name, Email Address, and Phone Number. Click [Proceed to Payment].
* **Result:** The system displays the Order Summary pane and mounts the secure Payment Gateway iframe/modal.
* **Action:** Input Credit/Debit Card details and click [Confirm & Pay].
* **Result:** The system transmits the tokenized payload to the payment processor.
* **Action:** Await Gateway Response.
* **Result (Success):** The system updates the booking status to Confirmed, routes the guest to a "Thank You" screen displaying the Booking ID, and triggers the automated email receipt.
* **Result (Failure):** The system displays a localized error message (e.g., "Insufficient Funds") and keeps the user on the payment page to retry before the hold expires.

### 6. Status Flow
This module governs the pre-arrival state of the reservation and the financial transaction:
**Booking State:**
* **Browsing:** User is viewing dates/rooms.
* **Pending Payment:** User is in the checkout flow; inventory is temporarily held.
* **Confirmed:** Payment successful; inventory is permanently allocated.
* **Abandoned:** The 10-minute hold expired without payment. Hold is released.

**Payment State:**
* **Unpaid:** Default state.
* **Processing:** Token sent to gateway, awaiting callback.
* **Captured:** Funds successfully secured.
* **Declined:** Transaction rejected by issuing bank.

### 7. Inputs and Outputs
* **Inputs Required:** Check-in/Check-out dates, Guest PII (Name, Email, Phone), Payment Token (Card details - handled securely, never stored in our database).
* **Outputs Generated:** Unique Alphanumeric Booking Reference, Automated Email Payload, Transaction ID from the Payment Gateway.

### 8. Constraints and Edge Cases
* **Edge Case: Payment Gateway Timeout.** If the payment gateway fails to respond within 30 seconds, the system will automatically void the local transaction, release the room hold, and prompt the user to try again later.
* **Constraint: PCI-DSS Compliance.** The hotel servers must never touch or store raw credit card numbers. All inputs must utilize secure, tokenized fields provided directly by the payment processor's SDK.

### 9. Integration
* **Module 1 (Web Storefront):** Inherits the dates and room selection from the public UI.
* **Module 3 (Front Desk):** Immediately pushes the Confirmed booking data into the centralized ledger for staff visibility.
* **Module 4 (Inventory):** Pings the database to verify real-time availability and lock physical inventory.
* **External APIs:** Requires integration with a Payment Service Provider (e.g., Stripe) and an Email Delivery Service (e.g., SendGrid or AWS SES).

---

## Module 3: Front Desk & Reservation Management
**Document Status:** Draft for Review (Updated: Incidental Deposits)  
**Module Owner:** Front Desk Operations  
**Prepared By:** Bradley Mosuela, Project Manager  

### 1. Overview
The Front Desk & Reservation Management module is the central operational hub for hotel staff. It provides a comprehensive interface to view, modify, and process all guest reservations. This module enables staff to seamlessly handle guest life cycles from initial booking (including offline walk-ins) through check-in, incidental deposit management, and final check-out.

### 2. Scope and Limitations
**In-Scope (MVP):**
* Centralized ledger for viewing all reservations (online and offline).
* Manual creation of reservations for walk-in guests or phone bookings.
* Processing of Check-Ins, Check-Outs, and Incidental Deposits (Cash/Card Holds).
* Manual assignment or reassignment of specific room numbers.
* Cancellation processing.

**Out of Scope (MVP):**
* Automated group booking management (e.g., booking blocks of 10+ rooms via a single parent folio).
* Automated waitlist management.
* Third-party OTA (Online Travel Agency) synchronization.

### 3. User Roles and Responsibilities
* **Front Desk Staff:** Primary operators. Authorized to create manual bookings, process check-ins/check-outs, and update reservation details.
* **System Administrator (Super Admin):** Escalation authority. Can override system locks, force cancellations without penalty, and audit the reservation ledger.
* **Prerequisite:** Users must be authenticated and assigned to either the Front Desk or Admin security groups to access this module.

### 4. Business Logic and Rules
* **Availability Lock:** The system must instantly lock a room's availability for the requested dates the moment a manual booking is initiated to prevent double-booking.
* **Clean Room Mandate:** A guest cannot be transitioned to a "Checked-In" status unless the assigned physical room status is strictly set to Available (Module 4).
* **Incidental Deposit Mandate:** A guest cannot be officially "Checked-In" until an Incidental Deposit (e.g., 1,000 PHP) is logged in the system. The user must select the deposit method (Cash or Physical Card Auth).
* **Payment Requirement:** Walk-in reservations must capture full room payment via cash or offline terminal before transitioning to "Confirmed," in addition to the incidental deposit.

### 5. Process Flow
Note: The following uses the Action-Result standard for execution.

**Process A: Processing a Walk-In Reservation**
* **Action:** Click the [+ New Reservation] button on the main dashboard.
* **Result:** The Manual Booking wizard opens.
* **Action:** Enter the desired Check-In and Check-Out dates, then click [Search Availability].
* **Result:** The system displays a list of available room types and unassigned physical room numbers.
* **Action:** Select a specific Room Number and click [Allocate].
* **Result:** The room is temporarily locked. The Guest Information form appears.
* **Action:** Enter the guest's Name, Phone, and Email. Select the 'Payment Method' (Cash or Physical Card). Click [Confirm Booking].
* **Result:** The system generates a Booking Reference Number, updates the ledger, and sets the reservation status to Confirmed.

**Process B: Processing a Check-In & Deposit**
* **Action:** Search the guest's name or booking reference in the Centralized Ledger and click on the row.
* **Result:** The Reservation Details modal opens.
* **Action:** Verify the guest's identity and click [Initiate Check-In].
* **Result:** The Incidental Deposit prompt appears.
* **Action:** Collect the deposit physically. Select [Cash] or [Card Auth] from the dropdown, enter the amount collected, and click [Complete Check-In].
* **Result:** The reservation status updates to Checked-In, the physical room status updates to Occupied, and the cash (if applicable) is logged as a Liability in the Financial Ledger.

**Process C: Processing a Check-Out & Deposit Refund**
* **Action:** Open the guest's active Reservation Details and click [Initiate Check-Out].
* **Result:** The system checks for any open Housekeeping/Maintenance flags and prompts the "Resolve Incidental Deposit" modal.
* **Action:** Select [Refund Full Deposit] and hand the physical cash back to the guest. (Alternatively, select [Forfeit Partial/Full] if damage was reported). Click [Complete Check-Out].
* **Result:** The reservation status updates to Checked-Out, the room status changes to Dirty, and the refunded deposit is deducted from the expected cash drawer balance.

### 6. Status Flow
The reservation state machine follows these strict transitions:
* **Pending:** Booking created, awaiting payment confirmation (usually online).
* **Confirmed:** Payment verified or physical guarantee captured. Room allocated.
* **Checked-In:** Guest is physically on-site and deposit is secured. Room status changes to Occupied.
* **Checked-Out:** Guest has left, and deposit is resolved. Room status changes to Dirty. Ledger closed.
* **Canceled:** Booking voided prior to Check-In. Room allocation released.

### 7. Inputs and Outputs
* **Inputs Required:** Date ranges (Start/End), Guest PII, Payment Type, Deposit Amount, Deposit Method (Cash/Card).
* **Outputs Generated:** Unique Booking Reference ID, Status Update Signals (to Room Inventory), Transaction & Liability Records (to Financial Ledger).

### 8. Constraints and Edge Cases
* **Edge Case: Early Check-In Attempt.** If a staff member attempts to check in a guest but the assigned room is marked Dirty or Cleaning, the system will throw a hard stop error: "Room not ready. Reassign room or await Housekeeping clearance."
* **Constraint:** Past dates cannot be selected for new manual bookings.

### 9. Integration
* **Module 4 (Inventory):** Pings for room availability; pushes Occupied or Dirty status commands.
* **Module 5 (Financial Ledger):** Pushes offline payment and temporary deposit data to ensure the daily drawer balances accurately reflect both revenue and held liabilities.

---

## Module 4: Inventory & Maintenance Operations
**Document Status:** Draft for Review  
**Module Owner:** Housekeeping & Facilities Management  
**Prepared By:** Bradley Mosuela, Project Manager  

### 1. Overview
The Inventory & Maintenance Operations module acts as the digital backbone for the hotel's physical assets. It provides Administrators with tools to manage the master room list and baseline pricing, while giving Housekeeping and Maintenance staff a real-time, mobile-friendly interface to track cleaning life cycles and log facility repairs.

### 2. Scope and Limitations
**In-Scope (MVP):**
* Creation, modification, and retirement of physical rooms and room types.
* Real-time Housekeeping dashboard for updating room cleanliness statuses.
* Ticketing system for logging, viewing, and resolving basic maintenance issues.
* Mobile/tablet-responsive UI for on-the-go staff.

**Out of Scope (MVP):**
* Consumables inventory tracking (e.g., counting physical soap, towels, or minibar items).
* Automated IoT room integrations (e.g., smart locks or thermostat triggers).
* Predictive or scheduled maintenance planning (only reactive issue logging is supported in MVP).

### 3. User Roles and Responsibilities
* **System Administrator:** Full access. Authorized to add/remove rooms, change base pricing, and force-override room statuses.
* **Housekeeping Staff:** Operational access. Authorized to view assigned rooms and update statuses from Dirty to Cleaning to Available.
* **Maintenance Staff:** Operational access. Authorized to view maintenance logs, update ticket statuses, and toggle a room into or out of Out of Order status.
* **Front Desk:** Read-only access to Housekeeping statuses; capability to log maintenance tickets on behalf of guests.

### 4. Business Logic and Rules
* **The Hard Stop Rule:** Any room with a physical status of Dirty, Cleaning, or Out of Order is strictly excluded from the "Available" pool in the Web Booking Engine (Module 2) and Front Desk Walk-In Allocation (Module 3).
* **Automated Degradation:** When Front Desk processes a "Check-Out" (Module 3), the system must automatically downgrade that specific physical room's status to Dirty.
* **Ticket Exclusivity:** A room can have multiple open maintenance tickets, but if a ticket is marked with the flag "Critical", the room must automatically transition to Out of Order.

### 5. Process Flow
**Process A: Clearing a Dirty Room (Housekeeping)**
* **Action:** Open the Housekeeping Dashboard and tap the [Dirty] filter tab.
* **Result:** The system displays a grid of all rooms currently requiring cleaning.
* **Action:** Tap on the desired Room Card, then tap [Start Cleaning].
* **Result:** The room status updates to Cleaning to inform Front Desk that work is in progress.
* **Action:** Upon completing the physical work, tap [Mark as Inspected & Available].
* **Result:** The room status updates to Available and is immediately pushed back into the sellable inventory pool.

**Process B: Logging a Maintenance Ticket (Front Desk/Staff)**
* **Action:** Click [+ New Ticket] from the Maintenance Dashboard.
* **Result:** The New Issue form modal opens.
* **Action:** Select the specific Room Number, enter a Description (e.g., "Leaking sink"), and check the [Critical / Take Out of Order] box if the room is uninhabitable. Click [Submit Ticket].
* **Result:** The ticket is added to the Maintenance queue. If "Critical" was checked, the room status instantly changes to Out of Order, overriding any previous status.

### 6. Status Flow
This module governs two distinct state machines:
**Physical Room Status:**
* **Available:** Clean and ready for allocation.
* **Occupied:** Currently inhabited by a checked-in guest.
* **Dirty:** Guest has checked out; requires cleaning.
* **Cleaning:** Housekeeping is currently inside the room.
* **Out of Order (OOO):** Uninhabitable due to maintenance. Removes from inventory.

**Maintenance Ticket Status:**
* **Open:** Issue reported, awaiting technician.
* **In Progress:** Technician actively working on the issue.
* **Resolved:** Issue fixed. (Note: Resolving an OOO ticket does not make the room Available; it reverts it to Dirty to ensure Housekeeping cleans up after maintenance).

### 7. Inputs and Outputs
* **Inputs Required:** Room Metadata (Type, Base Rate, Max Capacity), Housekeeping Status Toggles, Maintenance Ticket Details (Description, Severity).
* **Outputs Generated:** Real-time Availability Sync Signals (to Booking Engine), Status change timestamps (for audit logs).

### 8. Constraints and Edge Cases
* **Edge Case: Occupied Room Maintenance:** If a ticket is logged for an Occupied room (e.g., guest reports broken TV but stays in the room), the room does not go Out of Order. The ticket remains active, but inventory is not impacted.
* **Constraint:** Base pricing adjustments made in the Room Inventory master list will only apply to future bookings, never to existing confirmed reservations.

### 9. Integration
* **Module 1 & 2 (Web/Booking Engine):** Acts as the source of truth for total possible inventory. Pushes Available room counts.
* **Module 3 (Front Desk):** Receives automated Dirty triggers upon Check-Out. Pushes Occupied status upon Check-In.

---

## Module 5: Financial Ledger Module
**Document Status:** Draft for Review (Updated: Incidental Deposits)  
**Module Owner:** Finance & Administration  
**Prepared By:** Bradley Mosuela, Project Manager  

### 1. Overview
The Financial Ledger Module serves as the centralized, immutable record of all incoming revenue, outbound refunds, and temporary liabilities (deposits). It acts as the financial bridge between automated online payments (Module 2) and manual, offline transactions processed at the Front Desk (Module 3). This module ensures accurate daily revenue tracking, shift reconciliation, and fraud prevention.

### 2. Scope and Limitations
**In-Scope (MVP):**
* Real-time aggregation of successful online payment gateway transactions.
* Manual logging of Front Desk offline transactions (Cash, Physical POS Terminal).
* Tracking of temporary liabilities (Incidental Deposits) distinct from recognized revenue.
* End-of-shift Cash Drawer Reconciliation workflow.
* Processing of authorized refunds (both online gateway triggers and offline cash returns).
* Immutable audit trail for all financial state changes.

**Out of Scope (MVP):**
* Comprehensive General Ledger (GL) accounting (e.g., Accounts Payable, Payroll, Asset Depreciation).
* Automated tax authority reporting.
* Complex split-billing.

### 3. User Roles and Responsibilities
* **Front Desk Staff:** Operational access. Authorized to view their own shift's transactions, log manual payments/deposits, and execute End-of-Shift drawer counts.
* **System Administrator (Finance Manager):** Full access. Authorized to view all global transactions, execute online payment gateway refunds, and override/approve shift discrepancies.

### 4. Business Logic and Rules
* **The Immutable Ledger Rule:** Once a transaction is finalized (status Settled), the database record cannot be deleted or modified by any user. Mistakes must be corrected via a tracked Void or Refund entry.
* **Liability vs. Revenue Recognition:** Cash collected for incidental deposits must be flagged internally as a Liability, not Revenue. It increases the physical "Expected Cash" in the drawer but is strictly excluded from "Total Revenue Today" reporting.
* **Shift Balancing Mandate:** A Front Desk user cannot formally close their shift until the physical cash counted in the drawer exactly matches the "Expected Cash" calculated by the system ledger (Revenue Cash + Active Cash Deposits).

### 5. Process Flow
**Process A: End-of-Shift Cash Reconciliation**
* **Action:** Click [Close Shift] on the Financial Dashboard.
* **Result:** The system locks the current shift ledger and opens the Drawer Count modal, hiding the system's "Expected Cash" total (Blind Count).
* **Action:** Count physical cash in the drawer (which includes active, un-refunded guest deposits), enter the exact numeric total, and click [Verify Count].
* **Result:** The system compares the inputted amount against the ledger's recorded cash transactions and deposit liabilities.
* **Action (If Match):** System displays "Balanced". Click [Submit & Sign Out].
* **Result:** The shift is closed, and the ledger carries over only the active cash deposits to the next shift's starting drawer.
* **Action (If Discrepancy):** System displays a "Discrepancy Warning" detailing the variance.
* **Result:** The user is forced to recount. If the discrepancy remains, an Admin must input their PIN to force-close the shift and log the variance.

**Process B: Executing an Online Refund**
* **Action:** (Admin Only) Search for the original Transaction ID in the Ledger and click the record.
* **Result:** The Transaction Details pane opens on the right.
* **Action:** Click [Issue Refund]. Enter the refund amount (Full or Partial) and select a Reason Code. Click [Confirm & Process Refund].
* **Result:** The system sends an API request to reverse the funds. A new negative transaction line is added, updating the original status to Refunded.

### 6. Status Flow
**Transaction State:**
* **Pending:** Payment initiated but funds not yet secured.
* **Settled:** Funds successfully captured (Revenue).
* **Liability Held:** Cash/Card hold secured but not recognized as revenue (Incidental Deposit).
* **Refunded:** Funds returned to the guest.
* **Voided:** Transaction cancelled before funds were captured.

### 7. Inputs and Outputs
* **Inputs Required:** Payment Amounts, Deposit Amounts, Payment Methods, User PINs (for overrides).
* **Outputs Generated:** Daily Revenue Summaries, Liability Summaries (Active Deposits), Shift Discrepancy Alerts.

### 8. Constraints and Edge Cases
* **Edge Case: Shift Change with Active Deposits.** If Shift A collects a 1,000 PHP cash deposit, and the guest checks out during Shift B, the system must seamlessly deduct that 1,000 PHP from Shift B's expected drawer total without flagging a discrepancy.
* **Constraint:** Refunds can only be processed back to the original payment method.

### 9. Integration
* **Module 2 (Booking Engine):** Pushes successful web transactions.
* **Module 3 (Front Desk):** Sends manual transaction data and deposit holds/refunds to keep the drawer math perfectly balanced.

---

## Module 6: System Administration & Security
**Document Status:** Draft for Review  
**Module Owner:** IT & General Management  
**Prepared By:** Bradley Mosuela, Project Manager  

### 1. Overview
The System Administration & Security module is the overarching control plane for the entire ERP system. It governs Role-Based Access Control (RBAC), user authentication, system-wide configurations, and the integrity of the audit trail. This module ensures that only authorized personnel can access sensitive operational and financial data.

### 2. Scope and Limitations
**In-Scope (MVP):**
* Creation, modification, and suspension of internal staff accounts.
* Assignment of hard-coded RBAC roles (Super Admin, Front Desk, Housekeeping).
* Global system settings management (e.g., Tax rates, Hotel Name, Contact Info).
* Secure authentication (Login, Logout, Password Reset).

**Out of Scope (MVP):**
* Custom role creation (e.g., granular permission toggling per user). Roles are predefined for the MVP.
* Single Sign-On (SSO) via Google/Microsoft or Active Directory integration.
* Automated HR onboarding workflows.

### 3. User Roles and Responsibilities
* **System Administrator (Super Admin):** Exclusive access. Authorized to manage all users, update global tax rates, and view system logs.
* **Prerequisite:** To prevent a system lockout, the database must be seeded with at least one undeletable "Master Admin" account upon deployment.

### 4. Business Logic and Rules
* **The Principle of Least Privilege:** Users must only be granted the minimum access necessary to perform their job. (e.g., Housekeeping cannot view financial ledgers; Front Desk cannot alter tax rates).
* **Soft-Delete Mandate:** Staff accounts can never be hard-deleted from the database. To remove access, an account must be flagged as Suspended or Inactive. This preserves the historical audit trail (e.g., knowing who processed a refund 6 months ago).
* **Cryptographic Security:** Passwords must be hashed and salted using industry-standard algorithms (e.g., bcrypt). Admins cannot view user passwords; they can only trigger a password reset link.

### 5. Process Flow
**Process A: Provisioning a New Staff Account**
* **Action:** Navigate to the User Management dashboard and click [+ Add User].
* **Result:** The New User form modal opens.
* **Action:** Enter the employee's First Name, Last Name, and official Email Address. Select the appropriate Role from the dropdown (Front Desk, Housekeeping, Admin). Click [Create User & Send Invite].
* **Result:** The system creates the account in a Pending state and automatically dispatches an email to the employee with a secure, one-time link to set their password.

**Process B: Updating the Global Tax Rate**
* **Action:** Navigate to Settings > Financial Configurations. Enter the new percentage value in the Base Tax Rate input field. Click [Save Configuration].
* **Result:** The system requires the Admin to re-enter their password to confirm the sensitive action.
* **Action:** Enter Admin password and click [Confirm].
* **Result:** The new tax rate is saved and will be applied to all future bookings. (Historical and active bookings retain the tax rate applied at the time of their creation).

### 6. Status Flow
**User Account Status:**
* **Pending:** Account created, awaiting the user to set their initial password.
* **Active:** User has full access according to their RBAC role.
* **Suspended:** Access revoked by an Admin. User cannot log in.
* **Locked:** Access temporarily blocked due to too many failed login attempts.

### 7. Inputs and Outputs
* **Inputs Required:** Staff PII (Name, Email), RBAC Role selections, Global configuration variables (Tax %, Contact Phone).
* **Outputs Generated:** Authentication Tokens (JWT/Session Cookies), Secure Password Reset Emails, System Audit Logs.

### 8. Constraints and Edge Cases
* **Edge Case: Admin Lockout.** If a Super Admin attempts to suspend their own account, the system must throw a hard stop error: "Action Denied: You cannot suspend your active session. Assign Admin rights to another user first."
* **Constraint: Session Timeouts.** For security, all staff sessions (except Housekeeping mobile devices) must automatically expire and force a logout after 60 minutes of inactivity.

### 9. Integration
* **All Modules:** Module 6 acts as the security gatekeeper. Every API request made by any module must validate its authentication token against Module 6 before executing.

---

## End-to-End System Workflow Rundown
**Document Status:** Approved Baseline  
**Prepared By:** Bradley Mosuela, Project Manager  

This document maps the data flow and system triggers across the six core modules of the Hotel Management System MVP. It illustrates how an action in one module cascades updates to the rest of the ecosystem.

### Workflow 1: The Online Guest Lifecycle
This is the primary happy-path for a digital customer, from discovering the hotel to leaving it.

**Discovery (Module 1 -> Module 4)**
* **Action:** Guest searches for dates on the website.
* **Data Flow:** Module 1 queries Module 4 (Inventory) in real-time. Module 4 checks for rooms strictly in the Available state and returns the pricing and capacity data back to Module 1 to display to the guest.

**Booking & Payment (Module 2 -> Mod 4 -> Mod 5 -> Mod 3)**
* **Action:** Guest clicks "Book," fills out details, and pays via credit card.
* **Data Flow:**
  * Module 2 places a 10-minute hold on the room in Module 4.
  * Payment is processed. Upon success, Module 2 pushes the financial transaction data (Revenue) into Module 5 (Financial Ledger).
  * Module 2 generates a Booking ID and pushes the full guest record to Module 3 (Front Desk Ledger).
  * The status is set to Confirmed.
  * Module 2 emails the guest.

**Physical Check-In (Module 3 -> Mod 4 -> Mod 5)**
* **Action:** Guest arrives. Front Desk collects 1,000 PHP cash deposit and hands over keys.
* **Data Flow:**
  * Staff clicks "Check-In" in Module 3. Status changes to Checked-In.
  * Module 3 pushes the 1,000 PHP cash data to Module 5.
  * Module 5 records this strictly as a Liability (increasing the expected cash drawer count, but NOT daily revenue).
  * Module 3 triggers Module 4. The physical room status shifts from Available to Occupied.

**Physical Check-Out (Module 3 -> Mod 5 -> Mod 4)**
* **Action:** Guest leaves. Front Desk returns the 1,000 PHP cash deposit.
* **Data Flow:**
  * Staff clicks "Check-Out" in Module 3. Status changes to Checked-Out.
  * Module 3 pushes the refund command to Module 5.
  * The liability is cleared, deducting 1,000 PHP from the expected cash drawer.
  * Module 3 triggers Module 4. The physical room automatically drops to Dirty. (It is now invisible to the booking engine).

**Room Recovery (Module 4 -> Mod 1 & 2)**
* **Action:** Housekeeping cleans the room and marks it "Inspected & Available" on their tablet.
* **Data Flow:** Module 4 updates the database. The room is instantly pushed back to Module 1 & 2, increasing the hotel's sellable inventory by +1.

### Workflow 2: The Walk-In Customer (Offline Lifecycle)
This maps how the system handles a guest who bypasses the website entirely.

**Manual Booking (Module 3 -> Module 4)**
* **Action:** Front Desk searches for a room and creates a manual reservation.
* **Data Flow:** Module 3 queries Module 4 to find an Available room. Once assigned, Module 4 immediately removes this room from the online web pool (Module 1 & 2) to prevent double-booking.

**Offline Payment Capture (Module 3 -> Module 5)**
* **Action:** Guest pays for the room rate (e.g., 5,000 PHP) and the incidental deposit (1,000 PHP) in cash.
* **Data Flow:** Module 3 pushes two distinct signals to Module 5:
  * **Signal A:** 5,000 PHP logged as Revenue (Settled).
  * **Signal B:** 1,000 PHP logged as a Liability (Held).
  * The Expected Cash Drawer in Module 5 instantly increases by 6,000 PHP.

### Workflow 3: The Maintenance Emergency
This maps how an operational failure protects future revenue.

**Issue Reported (Module 4 -> Mod 1, 2, & 3)**
* **Action:** A pipe bursts in Room 101. A staff member logs a "Critical" maintenance ticket in Module 4.
* **Data Flow:**
  * Module 4 immediately forces Room 101 into Out of Order (OOO).
  * This instantly triggers a sync to Modules 1 & 2 (Web/Booking), removing the room from the sellable inventory.
  * It flags a warning in Module 3 (Front Desk) so staff know they cannot assign walk-ins to this room.

**Issue Resolved (Module 4 -> Module 4)**
* **Action:** Maintenance fixes the pipe and resolves the ticket.
* **Data Flow:** Module 4 logic kicks in. The room does NOT become Available. It is automatically pushed to Dirty so Housekeeping is notified to clean up the maintenance mess before it can be sold again.

### Workflow 4: Shift Reconciliation (The Anti-Theft Protocol)
This maps how we protect your cash at the end of the day.

**Drawer Count (Module 5 -> Module 6)**
* **Action:** Front Desk staff clicks "Close Shift" and counts the physical cash in their till.
* **Data Flow:** Module 5 runs a calculation: (Starting Cash) + (Cash Revenue from Mod 3) + (Active Cash Liabilities/Deposits from Mod 3) - (Refunded Deposits) = Expected Total.
* **Result:** If the user's manual count matches the system, the shift closes. If it does not, Module 6 (Security) logic requires a Super Admin to input a PIN to force-close the shift, generating a permanent audit log of the missing funds.
