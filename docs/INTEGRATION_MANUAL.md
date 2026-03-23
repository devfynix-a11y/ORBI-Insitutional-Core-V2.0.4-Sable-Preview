# ORBI Sovereign Backend: Master Integration Manual (v31.0 Titanium)

**Classification**: INSTITUTIONAL / INTERNAL USE ONLY  
**Version**: 31.0.0 (Titanium Hardened)  
**Last Updated**: 2026-03-22

---

## 1. Executive Summary

The **ORBI Sovereign Backend** is a high-frequency, zero-trust financial operating system designed to power the next generation of African fintech. It is not merely an API; it is a **Sovereign Ledger** capable of atomic multi-leg settlements, real-time fraud detection via **Neural Sentinel AI**, and autonomous regulatory compliance.

This manual provides the definitive technical specification for integrating:
1.  **Official Mobile Applications** (iOS / Android)
2.  **Institutional Desktop Clients** (Teller / Admin)
3.  **Third-Party Financial Bridges** (M-Pesa, Banks, Crypto)

---

## 2. Global Infrastructure & Connectivity

### 2.1 Connection Matrix

| Parameter | Value | Description |
| :--- | :--- | :--- |
| **Production Endpoint** | `https://orbi-financial-technologies-c0re-v2026.onrender.com` | The primary Edge Gateway. **NO LOCALHOST**. |
| **Development Endpoint** | `https://orbi-financial-technologies-c0re-v2026.onrender.com` | The sandbox environment for testing. |
| **API Versioning** | `/v1/{DOMAIN}/{RESOURCE}` | Strict semantic versioning. (Alias: `/api/v1/...` and `/`) |
| **Real-Time Nexus** | `wss://orbi-financial-technologies-c0re-v2026.onrender.com/nexus-stream` | WebSocket for live balance/security events. |
| **Transport Security** | TLS 1.3 (ECC-384) | Mandatory encryption in transit. |
| **Data Encoding** | JSON (UTF-8) | Standard payload format. |

### 2.2 Mandatory Protocol Headers

The **Cyber Sentinel WAF** will summarily reject any request missing these headers.

| Header | Required? | Format | Description |
| :--- | :--- | :--- | :--- |
| `Authorization` | YES | `Bearer <JWT>` | The session token acquired via Login. |
| `x-orbi-app-id` | YES | `mobile-ios` \| `mobile-android` \| `OBI_INSTITUTIONAL_CORE_V25` \| `DPS_INSTITUTIONAL_CORE_V25` | Identifies the client cluster. |
| `x-orbi-app-origin` | YES | `ORBI_MOBILE_V2026` \| `OBI_INSTITUTIONAL_CORE_V25` \| `DPS_INSTITUTIONAL_CORE_V25` | Identifies the application origin. |
| `x-orbi-apk-hash` | CONDITIONAL | `SHA-256 Hash` | **REQUIRED** for Android native apps. |
| `x-orbi-trace` | YES | `UUID-v4` | Unique request ID for distributed tracing. |
| `x-idempotency-key` | CONDITIONAL | `UUID-v4` | **REQUIRED** for all `POST /transactions` operations. |
| `x-orbi-fingerprint` | YES | `SHA-256 Hash` | Unique Device ID (Required for Login/Refresh). |
| `Content-Type` | YES | `application/json` | Payload format. |

### 2.3 Full Intensive Backend Architecture

The system is composed of autonomous engines working in concert:

1.  **LogicCore (Business Orchestrator)**: The central nervous system that handles all business rules, transaction routing, and state transitions. It enforces the "Atomic Settlement" protocol (V2.0).
2.  **BankingEngine (Atomic Ledger)**: A professional-grade engine implementing a Dual-Vault architecture and multi-leg settlements. See [BANKING_ENGINE_V2.md](./BANKING_ENGINE_V2.md) for full technical details.
3.  **TransactionService (Financial Integrity)**: Orchestrates atomic ledger updates via `append_ledger_entries_v1`, performs proactive balance verification, and manages system-wide reconciliation and forensic reversals.
4.  **Sentinel (Neural Security Engine)**: An active AI participant that evaluates every request against 200+ risk vectors in <50ms. It handles WAF duties, behavioral analysis, and real-time threat blocking. It is supported by the **RiskEngine** (`/backend/security/RiskEngine.ts`) which provides a granular risk score (0-100) for every ingress operation.
5.  **ResilienceEngine (Infrastructure Immunity)**: Manages circuit breakers for all external dependencies (SMS gateways, Banking APIs). If a provider fails, it automatically reroutes traffic or degrades gracefully.
6.  **PolicyEngine (Financial Guard)**: Enforces institutional rules, transaction limits, and velocity caps at the ledger level (`/backend/ledger/PolicyEngine.ts`).
7.  **Audit (Immutable Ledger)**: A blockchain-inspired, append-only log that records every state change with cryptographic hashes. Ensures forensic non-repudiation.
8.  **ReconciliationEngine (Financial Integrity)**: Continuous multi-layer verification (Internal, System, External) to ensure absolute ledger integrity. See [RECONCILIATION_ENGINE.md](./RECONCILIATION_ENGINE.md).
9.  **AutonomousPilot (Self-Healing)**: A background daemon that monitors system health. It can automatically restart failing pods, clear stuck queues, and heal data inconsistencies without human intervention.
10. **RedisCluster (High-Speed Cache)**: Distributed memory store for session management, rate limiting, and real-time pub/sub messaging.

### 2.4 Real-Time Nexus (WebSockets)

The **Nexus Stream** provides a persistent, full-duplex connection for real-time updates.

**Endpoint**: `wss://orbi-financial-technologies-c0re-v2026.onrender.com/nexus-stream`

**Authentication Protocol**:
1.  **Connect**: Establish WebSocket connection.
2.  **Authenticate**: Send the first message with the user's JWT.
    ```json
    { "type": "AUTH", "token": "eyJhbG..." }
    ```
3.  **Listen**: Receive real-time events.

**Event Types**:
*   `NOTIFICATION`: User-facing alerts (Security, Transaction, System).
*   `ACTIVITY_LOG`: Background activity updates.
*   `KYC_UPDATE`: Real-time status changes for identity verification.

---

## 3. Identity & Access Management (IAM) Domain

The IAM system enforces **Zero-Trust Identity Quarantine (DIQ)**. New nodes start in `pending` state until fully hydrated.

### 3.1 Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/auth/signup` | Public | Register a new Sovereign Identity. |
| `POST` | `/v1/auth/login` | Public | Authenticate and retrieve JWT Session. |
| `POST` | `/v1/auth/refresh` | Public | Rotate Refresh Token & Session. |
| `GET` | `/v1/auth/session` | Protected | Validate current session token. |
| `GET` | `/v1/user/profile` | Protected | Fetch authoritative user profile. |
| `PATCH` | `/v1/user/profile` | Protected | Update profile fields. **Unverified**: Name, Phone, Address, Language, Notifs. **Verified**: Avatar, Language, Notifs. |
| `PATCH` | `/v1/user/login-info` | Protected | Update login credentials (email/password). |
| `GET` | `/v1/user/lookup?q={query}` | Protected | Search users by email/phone/name (Min 3 chars). |
| `GET` | `/v1/user/lookup/:customerId` | Protected | Direct identity resolution by Customer ID. |
| `POST` | `/v1/user/avatar` | Protected | Upload profile picture (Raw Binary). |
| `POST` | `/v1/user/kyc` | Protected | Submit KYC verification data. |
| `POST` | `/v1/user/kyc/scan` | Protected | AI-Powered KYC Auto-Scan (Neural OCR). |
| `POST` | `/v1/user/kyc/upload` | Protected | Upload KYC document (Raw Binary) to secure storage. |
| `GET` | `/v1/user/kyc/status` | Protected | Check current KYC verification status. |
| `GET` | `/v1/notifications` | Protected | Fetch user notifications. |
| `PATCH` | `/v1/notifications/{id}/read` | Protected | Mark a notification as read. |
| `PATCH` | `/v1/notifications/read-all` | Protected | Mark all notifications as read. |
| `DELETE` | `/v1/notifications/{id}` | Protected | Delete a notification. |
| `POST` | `/v1/admin/kyc/review` | Admin/HR | Approve or reject a KYC request. |
| `POST` | `/v1/admin/staff` | Admin | Create a new Staff/Admin/HR user. |
| `GET` | `/v1/admin/transactions` | Admin/Audit | Global transaction history for auditing. |
| `GET` | `/v1/admin/transactions/:id/ledger` | Admin/Audit | Detailed forensic ledger legs for a transaction. |
| `PATCH` | `/v1/admin/users/{id}/status` | Admin/HR | Update user account status (active/blocked/frozen). |
| `PATCH` | `/v1/admin/users/{id}/profile` | Admin/HR | Update user profile details (KYC, Name, etc). |
| `POST` | `/v1/messaging/email` | Admin | Send system email notifications via ORBI Gateway. |

### 3.2 Biometric Authentication (Passkeys)

**Single Device Policy**: A user can only have **ONE** active biometric device. Registering a new device requires OTP verification and revokes the old one.

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/auth/passkey/register/start` | Protected | Start Passkey registration. May return `CHALLENGE_REQUIRED`. |
| `POST` | `/v1/auth/passkey/register/finish` | Protected | Complete Passkey registration. |
| `POST` | `/v1/auth/passkey/login/start` | Public | Start Passkey login (lookup by `userId` or `identifier`). |
| `POST` | `/v1/auth/passkey/login/finish` | Public | Complete Passkey login & get session. |

**Device Change Flow (Challenge)**:
1. Call `/register/start`.
2. If response is `{ status: 'CHALLENGE_REQUIRED', requestId: '...' }`:
   - Prompt user for OTP (sent via SMS).
   - Call `/register/start` again with `{ otpCode: '123456', otpRequestId: '...' }`.
3. Proceed with WebAuthn registration.

### 3.3 Registration Payload & Protocol

**Customer ID Generation**:
The system automatically generates a unique, high-entropy Customer ID for every new identity.
*   **Format**: `FN{YY}-{RAND4}-{RAND4}` (e.g., `OB26-1234-5678`)
*   **Scalability**: Supports 100M unique IDs per year.

**Origin-Based Role Assignment**:
The system enforces strict role assignment based on the `app_origin` field in the metadata.

*   `OBI_MOBILE_V1` (Mobile App):
    *   **Role**: Forced to `CONSUMER`.
    *   **Registry**: Forced to `CONSUMER`.
    *   **Use Case**: Public user registration.

*   `OBI_INSTITUTIONAL_CORE_V25` / `DPS_INSTITUTIONAL_CORE_V25` (Internal):
    *   **Role**: Respected from input (e.g., `ADMIN`, `STAFF`).
    *   **Registry**: Forced to `STAFF`.
    *   **Use Case**: Admin/Staff creation.

**Payload**:
```json
{
  "email": "user@orbi.io",
  "password": "StrongPassword123!",
  "full_name": "Juma Jux",
  "phone": "+255712345678",
  "metadata": {
    "app_origin": "OBI_MOBILE_V1", // CRITICAL: Determines Role
    "nationality": "Tanzania"
  }
}
```

### 3.4 Login & Security Headers (Full Banking Model)
**Mandatory Header**: `x-orbi-fingerprint` (REQUIRED for Login & Refresh)
This header MUST contain a unique device identifier (e.g., hashed IMEI, Android ID, or UUID stored in Keychain).

**Login Request**:
```json
POST /v1/auth/login
Headers:
  x-orbi-fingerprint: "device-unique-hash-123"
Body:
{
  "email": "user@orbi.io",
  "password": "SecurePass123!"
}
```

**Response (Success 200)**:
```json
{
  "success": true,
  "data": {
    "user": { 
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "user_metadata": {
        "full_name": "John Doe",
        "customer_id": "OBI-839204"
      },
      "wallets": [
        {
          "id": "a1b2c3d4-...",
          "name": "DilPesa",
          "type": "operating",
          "currency": "TZS",
          "balance": 0,
          "accountNumber": "OBI-839204",  // <--- MATCHES CUSTOMER ID
          "metadata": {
            "account_number": "OBI-839204",
            "linked_customer_id": "OBI-839204",
            "card_type": "Virtual Master"
          }
        },
        {
          "id": "e5f6g7h8-...",
          "name": "PaySafe",
          "type": "operating", // (Internal Transfer Vault)
          "currency": "TZS",
          "balance": 0,
          "accountNumber": "ESC-OBI-839204", // <--- ESCROW ACCOUNT
          "metadata": {
            "account_number": "ESC-OBI-839204",
            "is_secure_escrow": true,
            "slogan": "Secure Internal Transfers"
          }
        }
      ]
    },
    "session": { ... },
    "access_token": "...",
    "biometric_setup_required": true
  }
}
```

**Frontend Usage Guide**:
1.  **Wallet Access**: Read `response.data.user.wallets` immediately after signup to populate the dashboard.
2.  **Account Number**: Use `wallet.accountNumber` to display the **Customer ID** (e.g., "OBI-839204") to the user.
3.  **Internal Transfers**: Use the **PaySafe** wallet (identified by `accountNumber` starting with `ESC-`) for secure internal escrow operations.

**Security Protocols**:
1.  **Device Limit**: A maximum of **2 accounts** can be linked to a single device fingerprint. Attempts to add a 3rd account will fail with `DEVICE_LIMIT_EXCEEDED`.
2.  **Single Active Session**: Logging in on a **new** or **untrusted** device will automatically **revoke all previous sessions** on other devices.
3.  **Mandatory Biometrics**: If `biometric_setup_required` is `true`, the app MUST force the user to complete the Passkey registration flow before allowing access to the dashboard.

**Refresh Token Rotation**:
To maintain a session, clients must call `/v1/auth/refresh` before the access token expires.
```json
POST /v1/auth/refresh
Headers:
  x-orbi-fingerprint: "device-unique-hash-123"
Body:
{
  "refresh_token": "current-refresh-token"
}
```
**Security Note**: If a refresh token is reused (e.g., stolen), the system will detect the anomaly and **REVOKE ALL SESSIONS** for that user immediately.

### 3.5 KYC Submission Payload
```json
{
  "full_name": "Juma Jux",
  "id_type": "NATIONAL_ID",
  "id_number": "1234567890",
  "document_url": "https://...",
  "selfie_url": "https://..."
}
```

### 3.6 KYC Verification Protocol

**Levels**:
*   **Level 0 (Unverified)**: Limited transaction volume.
*   **Level 1 (Pending)**: Documents submitted, under review.
*   **Level 2 (Verified)**: Full access, higher limits.
*   **Level 3 (Enhanced)**: Institutional/High-Net-Worth.

**Flow**:
1.  **Submission**: User POSTs to `/v1/user/kyc`. Status -> `pending_review`.
2.  **Review**: Admin reviews via `/v1/admin/kyc/review`.
3.  **Feedback**:
    *   **Real-Time**: WebSocket `NOTIFICATION` sent to user.
    *   **Session**: Next login includes updated `kyc_status` and `kyc_level` in `user_metadata`.
    *   **API**: `GET /v1/user/kyc/status` returns current state.

### 3.7 Notification Management

Users can manage their notifications via the API.

*   **Fetch**: `GET /v1/notifications` (Paginated)
*   **Mark Read**: `PATCH /v1/notifications/{id}/read`
*   **Mark All Read**: `PATCH /v1/notifications/read-all`
*   **Delete**: `DELETE /v1/notifications/{id}`

### 3.8 User Preferences & Internationalization

The Orbi platform supports granular user preferences for language and notifications. These can be updated via `PATCH /v1/user/profile`.

**Available Preference Fields:**
| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `language` | `string` | `"en"` | Preferred language (`"en"` or `"sw"`). |
| `notif_security` | `boolean` | `true` | Toggle for security alerts. |
| `notif_financial` | `boolean` | `true` | Toggle for transaction alerts. |
| `notif_budget` | `boolean` | `true` | Toggle for budget alerts. |
| `notif_marketing` | `boolean` | `false` | Toggle for marketing alerts. |

**Example Update Payload:**
```json
{
  "language": "sw",
  "notif_marketing": true,
  "notif_budget": false
}
```

### 3.9 Admin/HR Operations
**Create Staff (Admin Only)**
```json
POST /v1/admin/staff
{
  "email": "hr@orbi.io",
  "password": "SecureStaffPass!",
  "full_name": "HR Manager",
  "role": "HUMAN_RESOURCE",
  "phone": "+255...",
  "nationality": "Tanzania"
}
```

**Update User Status (Admin/HR)**
```json
PATCH /v1/admin/users/{uuid}/status
{
  "status": "frozen" 
}
```

**Update User Profile (Admin/HR)**
```json
PATCH /v1/admin/users/{uuid}/profile
{
  "full_name": "Corrected Name",
  "kyc_level": 2,
  "kyc_status": "verified"
}
```

**KYC Review (Admin/HR)**
```json
POST /v1/admin/kyc/review
{
  "requestId": "uuid-of-request",
  "decision": "APPROVED",
  "reason": "Documents verified"
}
```

### 3.9 Avatar Upload Protocol
The system accepts raw binary image data for profile pictures.

**Single Active Avatar Policy**: To optimize storage, the system automatically deletes the previous avatar from the cloud bucket before committing the new one.

**Endpoint**: `POST /v1/user/avatar`
**Headers**:
*   `Authorization`: `Bearer <JWT>`
*   `Content-Type`: `image/png`, `image/jpeg`, or `image/webp`

**Payload**: Raw binary file data (Max 5MB).

**Response**:
```json
{
  "success": true,
  "data": {
    "avatar_url": "https://..."
  }
}
```

### 3.10 KYC Auto-Scan Machine (Neural OCR)
The system provides a Neural OCR endpoint powered by Gemini to automatically extract identity information with strict schema enforcement.

**Endpoint**: `POST /v1/user/kyc/scan`
**Headers**:
*   `Authorization`: `Bearer <JWT>`
*   `Content-Type`: `image/png`, `image/jpeg`, or `image/webp`
**Payload**: Raw binary image data.

**Response Schema**:
The engine returns a structured JSON object. If a field is unreadable, it returns a descriptive error.
```json
{
  "success": true,
  "data": {
    "full_name": "Juma Jux",
    "id_number": "1234567890",
    "id_type": "NATIONAL_ID", // Strictly: NATIONAL_ID, PASSPORT, DRIVER_LICENSE, VOTER_ID
    "dob": "1990-01-01",
    "expiry_date": "2030-01-01",
    "nationality": "Tanzania"
  }
}
```
**Integration**: Use this to pre-fill the KYC submission form in the client application.

### 3.5 OTP Generation & Verification

ORBI uses a secure OTP (One-Time Password) system for sensitive actions and phone-based login.

**Channel Prioritization:**
The system automatically determines the best delivery channel for OTPs:
1.  **SMS**: Primary channel if a valid phone number is available.
2.  **Push**: Fallback if no phone is available but an FCM token exists.
3.  **Email**: Final fallback if neither SMS nor Push is available.

*Note: For users in Tanzania (+255), SMS is strictly prioritized to ensure reliable delivery.*

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/auth/otp/initiate` | Public/Protected | Generate and send a new OTP. |
| `POST` | `/v1/auth/verify` | Protected | Verify an OTP code for a sensitive action. |

---

## 4. Wealth & Ledger Domain

The **Atomic Ledger** is the heart of ORBI. It ensures double-entry consistency for every micro-transaction.

### 4.1 Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/wallets` | Protected | List all sovereign vaults and linked accounts. |
| `GET` | `/v1/wallets/linked` | Protected | List linked external accounts. |
| `GET` | `/v1/wallets/sovereign` | Protected | List sovereign vaults. |
| `POST` | `/v1/wallets` | Protected | Create a new sub-wallet or link external account. |
| `POST` | `/v1/transactions/settle` | Protected | **CRITICAL**: Execute multi-leg money movement. |
| `POST` | `/v1/transactions/preview` | Protected | **NEW**: Pre-flight check for fees, recipient, and security. |
| `GET` | `/v1/fx/quote` | Protected | **NEW**: Get real-time exchange rate and conversion fee. |
| `GET` | `/v1/transactions` | Protected | Fetch paginated transaction history. |
| `GET` | `/v1/merchants` | Protected | List available merchants. |
| `GET` | `/v1/merchants/categories` | Protected | List merchant categories. |
| `POST` | `/v1/merchants/accounts` | Protected | **NEW**: Create a Multi-Tenant Merchant Account. |
| `GET` | `/v1/merchants/accounts/my` | Protected | **NEW**: List Merchant Accounts owned by user. |
| `GET` | `/v1/merchants/accounts/:id` | Protected | **NEW**: Get Merchant Account details. |
| `PATCH` | `/v1/merchants/accounts/:id/settlement` | Protected | **NEW**: Update Merchant Settlement info. |
| `GET` | `/v1/notifications` | Protected | Fetch paginated user notifications. |
| `PATCH` | `/v1/notifications/:id/read` | Protected | Mark a specific notification as read. |
| `PATCH` | `/v1/notifications/read-all` | Protected | Mark all notifications as read. |
| `DELETE` | `/v1/notifications/:id` | Protected | Delete a specific notification. |
| `GET` | `/v1/escrow` | Protected | **NEW**: List all escrow agreements for the user. |
| `GET` | `/v1/escrow/:id` | Protected | **NEW**: Get details of a specific escrow agreement. |
| `POST` | `/v1/escrow/create` | Protected | **NEW**: Create a conditional escrow payment. |
| `POST` | `/v1/escrow/:ref/release` | Protected | **NEW**: Release funds from escrow to recipient. |
| `POST` | `/v1/escrow/:ref/dispute` | Protected | **NEW**: Dispute an escrow payment. |
| `POST` | `/v1/escrow/:ref/refund` | Admin | **NEW**: Refund an escrow payment to sender. |

### 4.2 FX Quote (Multi-Currency)

Before performing a cross-currency transfer, fetch a live quote to display the exact exchange rate and conversion fee.

**Request:** `GET /v1/fx/quote?from=USD&to=TZS&amount=100`

**Response:**
```json
{
  "success": true,
  "data": {
    "originalAmount": 100,
    "fromCurrency": "USD",
    "toCurrency": "TZS",
    "exchangeRate": 2550,
    "fee": 1275,
    "finalAmount": 253725
  }
}
```

### 4.3 Atomic Settlement Payload
**Header**: `x-idempotency-key` (REQUIRED)

The system supports settlement via direct `targetWalletId` or via `recipient_customer_id` (Internal Lookup).

```json
{
  "type": "PEER_TRANSFER",
  "amount": 5000.00,
  "currency": "TZS",
  "sourceWalletId": "uuid-source-wallet",
  "recipient_customer_id": "OB26-1234-5678",
  "description": "Lunch reimbursement"
}
```

### 4.3 Sovereign Wallets (DilPesa & PaySafe)
Every Sovereign Identity is provisioned with two primary operating vaults:

#### 1. DilPesa (Primary Operating Vault)
This is the user's main transactional account, linked to a Virtual Master Card profile.
*   **Name**: `DilPesa`
*   **Account Number**: Matches the User's **Customer ID** (e.g., `OBI-839204`).
*   **Use Case**: External deposits, payments, and card transactions.

#### 2. PaySafe (Internal Escrow Vault)
A secure vault designed for internal transfers and escrow holdings.
*   **Name**: `PaySafe`
*   **Account Number**: Prefixed with `ESC-` (e.g., `ESC-OBI-839204`).
*   **Use Case**: Secure internal transfers, holding funds during disputes, or high-value staging.

**Technical Schema (Common Fields):**
- `id`: UUID (Primary Key)
- `type`: `"operating"`
- `currency`: `"TZS"`
- `balance`: Decimal (e.g., `0.00`)
- `accountNumber`: String (Unique Identifier)
- `metadata`:
    - `linked_customer_id`: Institutional ID
    - `card_type`: `"Virtual Master"` (DilPesa only)
    - `is_secure_escrow`: `true` (PaySafe only)

**Security Layer**: All vault data is encrypted via the **DataVault Protocol** (AES-GCM 256-bit) and monitored by the **Vault Auditor** for forensic integrity. See [BANKING_ENGINE_V2.md](./BANKING_ENGINE_V2.md) for full technical details.

### 4.4 Transaction Preview (Pre-Flight)
Before executing a settlement, clients **MUST** call the preview endpoint to show the user the final cost and verify the recipient.

**Endpoint**: `POST /v1/transactions/preview`

**Behavior**: This endpoint **always** returns the full fee breakdown and the user's `available_balance`, even if the user has insufficient funds. This allows the frontend to calculate the shortfall (e.g., `total - available_balance`) and display a helpful message.

**Payload**:
```json
{
  "recipient_customer_id": "OB26-1234-5678",
  "amount": 50000,
  "currency": "TZS",
  "type": "PEER_TRANSFER",
  "description": "Dinner payment"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "simulation_ready",
    "breakdown": {
      "base": 50000,
      "tax": 50,
      "fee": 500,
      "total": 50550,
      "available_balance": 40000 // <--- User has 40k, needs 50.55k
    },
    "metadata": {
      "receiver_details": {
        "profile": {
          "full_name": "Juma Jux",
          "avatar_url": "https://...",
          "customer_id": "OB26-1234-5678"
        }
      },
      "security_decision": "ALLOW"
    }
  }
}
```

### 4.5 Transaction Lifecycle: From Preview to Staged Settlement

The ORBI transaction lifecycle is designed for maximum transparency and security. It follows a strict **Preview -> Confirm -> Lock -> Settle** pattern.

#### Phase 1: Simulation (The Preview)
*   **Action**: Client calls `/v1/transactions/preview`.
*   **Engine**: The `PaymentsProcessor` invokes the `BankingEngine` with `isSimulation: true`.
*   **Logic**:
    *   Calculates real-time regulatory fees and platform taxes.
    *   Resolves recipient identity (e.g., from Phone or Customer ID).
    *   Performs a "Soft" Security Audit via Neural Sentinel.
*   **Result**: Returns a high-fidelity breakdown of costs and recipient metadata.

#### Phase 2: User Confirmation
*   **Action**: The UI displays the breakdown to the user.
*   **Requirement**: The user must explicitly confirm the final `total` amount.
*   **Security**: For high-value transactions, this phase may trigger a Biometric Challenge (Passkey).

#### Phase 3: Staged Lock (The Commit)
*   **Action**: Client calls `/v1/transactions/settle` with `dryRun: false`.
*   **Engine**: The `BankingEngine` executes the first leg of the multi-leg ACID commit.
*   **Logic**:
    1.  **Idempotency Check**: Uses `x-idempotency-key` to prevent duplicate processing.
    2.  **Balance Check**: If `total_amount > available_balance`, throws `INSUFFICIENT_FUNDS` (400).
    3.  **Hard Security Audit**: Neural Sentinel performs final behavioral validation.
    4.  **Ledger Commit (Lock)**:
        - Debit Sender Operating Vault (Total Amount).
        - Credit Internal Escrow (PaySafe) (Principal Amount).
        - Credit Fee Collector (Taxes/Fees).
        - **Status**: Transaction is marked as `processing`.
*   **Result**: Returns the `Transaction` object with status `processing`.

#### Phase 4: Automated Settlement (The Release)
*   **Action**: Background `PaymentsProcessor` runs every 60 seconds.
*   **Logic**:
    1.  Identifies transactions in `processing` state.
    2.  **Validation**: Re-verifies recipient status and system health.
    3.  **Final Settlement**:
        - Debit Internal Escrow (PaySafe).
        - Credit Recipient Operating Vault.
        - **Status**: Updates to `completed`.
    4.  **Notification**: Triggers `Messaging.dispatch` to alert both Sender ("Transfer Completed") and Recipient ("Funds Received").
*   **Timeouts**:
    - **Auto-Reversal**: Transactions stuck in `processing` for > 5 minutes are automatically reversed (refunded to sender) and marked as `failed`.
    - **Manual Review**: Transactions flagged for review expire after 24 hours if not approved.

---

## 5. Strategy & System Domains

### 5.1 Strategy Endpoints
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/goals` | Protected | **NEW**: List all financial goals for the user. |
| `POST` | `/v1/goals` | Protected | Create a financial goal (Savings Pot). |
| `POST` | `/v1/goals/{id}/allocate` | Protected | Move funds into a goal. |
| `DELETE` | `/v1/goals/{id}` | Protected | **NEW**: Delete a specific financial goal. |
| `GET` | `/v1/categories` | Protected | **NEW**: List all budget categories. |
| `POST` | `/v1/categories` | Protected | **NEW**: Create a new budget category. |
| `PATCH` | `/v1/categories/{id}` | Protected | **NEW**: Update a budget category. |
| `DELETE` | `/v1/categories/{id}` | Protected | **NEW**: Delete a budget category. |
| `GET` | `/v1/tasks` | Protected | **NEW**: List all strategic tasks. |
| `POST` | `/v1/tasks` | Protected | **NEW**: Create a new strategic task. |
| `PATCH` | `/v1/tasks/{id}` | Protected | **NEW**: Update a strategic task. |
| `DELETE` | `/v1/tasks/{id}` | Protected | **NEW**: Delete a strategic task. |

### 5.2 Enterprise & Treasury Endpoints
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/enterprise/organizations` | Protected | **NEW**: List organizations the user belongs to. |
| `POST` | `/v1/enterprise/organizations` | Protected | **NEW**: Create a new organization. |
| `GET` | `/v1/enterprise/organizations/:id` | Protected | **NEW**: Get organization details. |
| `POST` | `/v1/enterprise/users/link` | Protected | **NEW**: Link a user to an organization. |
| `POST` | `/v1/enterprise/users/invite` | Protected | **NEW**: Invite a user to an organization. |
| `POST` | `/v1/enterprise/treasury/autosweep` | Protected | **NEW**: Configure treasury auto-sweep logic. |
| `POST` | `/v1/enterprise/treasury/withdraw/request` | Protected | **NEW**: Request a treasury withdrawal (Multi-Sig). |
| `POST` | `/v1/enterprise/treasury/withdraw/approve` | Admin | **NEW**: Approve a pending treasury withdrawal. |
| `GET` | `/v1/enterprise/treasury/approvals` | Protected | **NEW**: List pending treasury approvals. |
| `GET` | `/v1/enterprise/budgets/alerts` | Protected | **NEW**: List budget enforcement alerts. |

### 5.3 System Endpoints
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/sys/bootstrap` | Protected | Fetch initial app state (wallets, txs, profile) in one call. |
| `GET` | `/v1/sys/metrics` | Protected | View system health and throughput. |
| `POST` | `/v1/admin/reconciliation/run` | Admin | **NEW**: Trigger a full reconciliation cycle. |
| `GET` | `/v1/admin/reconciliation/reports` | Admin | **NEW**: Fetch reconciliation integrity reports. |
| `GET` | `/health` | Public | Infrastructure health check (Circuit Breakers). |
| `GET` | `/` | Public | API Root / Status. |

---

## 6. Neural Sentinel AI (Security)

Every request is analyzed by the **Sentinel Engine** against 200+ heuristic rules.

### 6.1 Risk Scoring
*   **0 - 40 (Low Risk)**: Request Allowed.
*   **41 - 80 (Medium Risk)**: Challenge Required (MFA/OTP).
*   **81 - 100 (Critical Risk)**: **BLOCK** & Account Freeze.

### 6.2 Common Block Triggers
*   **Velocity**: > 10 auth attempts in 1 minute.
*   **Geographic**: IP address mismatch with `nationality`.
*   **Identity**: `account_status` is `pending` (for sensitive ops).

---

## 7. Error Handling & Codes

The API returns standard HTTP status codes along with a JSON error object: `{ "success": false, "error": "CODE", "message": "..." }`.

**Recent Hardening Update (v28.3)**: All API routes (both `/v1` and `/admin`) are now fully wrapped in comprehensive `try-catch` blocks. This ensures that any unhandled exceptions or internal faults are gracefully caught, logged, and returned as a standard `500 INTERNAL_SERVER_ERROR` payload, preventing server crashes and maintaining atomic ledger integrity.

| Code | Error Constant | HTTP | Meaning |
| :--- | :--- | :--- | :--- |
| `INFRA_RATE_LIMIT_EXCEEDED` | `INFRA_RATE_LIMIT_EXCEEDED` | 429 | Global IP rate limit hit (DDoS protection). |
| `AUTH_THROTTLED` | `AUTH_THROTTLED_BRUTE_FORCE_PROTECTION` | 429 | Too many login attempts. |
| `VALIDATION_FAILED` | `VALIDATION_FAILED` | 400 | Payload does not match Zod schema. |
| `IDENTITY_REQUIRED` | `IDENTITY_REQUIRED` | 401 | Session token is missing or invalid. |
| `AUTH_REQUIRED` | `AUTH_REQUIRED` | 401 | Endpoint requires authentication. |
| `SENTINEL_BLOCK` | `SENTINEL_BLOCK` | 403 | **CRITICAL**: AI Security Engine blocked the request. |
| `SECURITY_BLOCK` | `SECURITY_BLOCK` | 403 | **CRITICAL**: Risk Scoring Engine blocked the request due to high risk score. |
| `POLICY_VIOLATION` | `POLICY_VIOLATION` | 403 | **CRITICAL**: Transaction blocked by Policy Engine (Limits/Velocity). |
| `IDENTITY_LOCKED` | `IDENTITY_LOCKED` | 403 | Account is Frozen or Blocked. |
| `KYC_LIMIT_EXCEEDED` | `KYC_LIMIT_EXCEEDED` | 403 | Transaction exceeds limit for unverified account. |
| `QUERY_TOO_SHORT` | `QUERY_TOO_SHORT` | 400 | Search query must be > 3 characters. |
| `USER_NOT_FOUND` | `USER_NOT_FOUND` | 404 | Target user does not exist. |
| `MISSING_PARAMS` | `MISSING_PARAMS` | 400 | Required fields missing. |
| `INSUFFICIENT_FUNDS` | `INSUFFICIENT_FUNDS` | 400 | Wallet balance is lower than total transaction amount. |
| `UNKNOWN_OP` | `UNKNOWN_OP` | 404 | Legacy operation not found. |
| `EXECUTION_FAULT` | `EXECUTION_FAULT` | 500 | Internal Server Error / Crash. |

---

## 8. Request Examples (Live Production)

**WARNING**: These examples use the **LIVE** Cloud Run environment. **DO NOT USE LOCALHOST**.

### 8.1 Login Request
```bash
curl -X POST https://orbi-financial-technologies-c0re-v2026.onrender.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "x-orbi-app-id: mobile-android" \
  -d '{
    "e": "user@orbi.io",
    "p": "SecurePass123!"
  }'
```

**Response (Success 200)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "...",
      "user_metadata": {
        "account_status": "active",
        "kyc_level": 1,
        "kyc_status": "verified",
        "id_type": "NATIONAL_ID",
        "id_number": "1234567890",
        "full_name": "..."
      }
    },
    "session": { ... },
    "access_token": "..."
  }
}
```

### 8.2 Get User Profile
```bash
curl -X GET https://orbi-financial-technologies-c0re-v2026.onrender.com/v1/user/profile \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \
  -H "x-orbi-app-id: mobile-android"
```

### 8.3 System Health Check
```bash
curl -X GET https://orbi-financial-technologies-c0re-v2026.onrender.com/health
```

---

## 9. Financial Partner Integration (Webhooks)

The system uses a **Dynamic Provider Routing** mechanism for incoming payment webhooks (e.g., M-Pesa C2B, Airtel Money). Instead of hardcoded endpoints, webhooks are routed based on the unique ID of the partner record in the database.

### 9.1 The Concept
1.  **Registry**: Every external financial institution (M-Pesa, Airtel, Banks) must be registered in the `financial_partners` table.
2.  **Routing**: The webhook URL includes the `id` (UUID) of the partner.
3.  **Security**: The system uses the `connection_secret` stored in the partner record to verify the request signature.

### 9.2 Step 1: Register the Partner (SQL)
You must insert the partner into the database to generate their unique ID and security credentials.

```sql
INSERT INTO public.financial_partners (
    name, 
    type, 
    status, 
    connection_secret, 
    provider_metadata
) VALUES (
    'M-Pesa Tanzania',          -- Name
    'MOBILE_MONEY',             -- Type
    'ACTIVE',                   -- Status
    'sec_mpesa_tz_839204',      -- Connection Secret (Used for Signature Verification)
    '{ "region": "TZ", "currency": "TZS", "logic_type": "MPESA_V2" }' -- Metadata
) RETURNING id;
```

**Result**:
`id`: `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11` (Save this UUID!)

### 9.3 Step 2: Construct the Webhook URL
Use the `id` from Step 1 to construct the callback URL you provide to the partner.

**Format**:
`https://<YOUR_APP_URL>/v1/webhooks/<PARTNER_UUID>`

**Example**:
`https://orbi-financial-technologies-c0re-v2026.onrender.com/v1/webhooks/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`

### 9.4 Step 3: Security & Verification
When a request hits this URL:
1.  The system looks up the partner by the UUID in the URL.
2.  It retrieves the `connection_secret` (`sec_mpesa_tz_839204`).
3.  It loads the specific provider logic based on the name (e.g., `MpesaProvider`).
4.  It verifies the request signature using the secret.

> **CRITICAL**: If the UUID in the URL does not exist or the signature fails, the request is rejected with `403 Forbidden`.

---

## 10. App Development Best Practices

### 10.1 Frontend State Management
*   **Real-Time Sync**: Do not rely on polling. Use the **Nexus Stream (WebSockets)** to listen for `NOTIFICATION` and `ACTIVITY_LOG` events to update the UI state.
*   **Optimistic Updates**: For non-financial operations (e.g., updating profile, marking notifications read), apply changes to the local state immediately and rollback only on failure.
*   **Vault Security**: Never store raw wallet balances in persistent storage (LocalStorage/SharedPreferences). Always fetch fresh data on app resume.

### 10.2 Mobile SDK Integration
*   **Certificate Pinning**: Mandatory for production builds to prevent Man-in-the-Middle (MITM) attacks.
*   **Secure Enclave**: Store the `access_token` and `refresh_token` in the device's Secure Enclave (iOS) or EncryptedSharedPreferences (Android).
*   **Biometric Fallback**: Always provide a PIN fallback if biometric authentication fails or is unavailable.

### 10.3 Security & Fingerprinting
*   **Device Integrity**: Use Play Integrity API (Android) or DeviceCheck (iOS) to generate the `x-orbi-fingerprint` header.
*   **Challenge Handling**: If an API returns `CHALLENGE_REQUIRED`, the app must navigate to the MFA/OTP screen and retry the original request with the `otpCode`.

### 10.4 Messaging & Notification Routing
**File**: `/backend/features/MessagingService.ts` & `/backend/security/otpService.ts`

ORBI implements an intelligent, multi-channel messaging router designed for high reliability and real-time engagement.

#### 10.4.1 Messaging Dispatcher (`MessagingService.dispatch`)
The `MessagingService.dispatch` method is the central hub for all outgoing communications. It supports:
- **Direct-to-App Notifications**: Real-time delivery via WebSockets (`nexus-stream`) if the user is currently online.
- **Multi-Channel Fallback**: If the user is offline or the direct-to-app delivery fails, the system automatically routes the message through secondary channels (Push, SMS, WhatsApp, Email) based on user preferences and regional specialization.
- **Transactional Reference Numbers (`refId`)**: Every transactional message (OTP, Security Alert, Payment Confirmation) is automatically assigned a unique 8-character reference ID for tracking and auditing.
- **Device Identification**: Notifications include the specific device name (e.g., "iPhone 15", "Android Device") extracted from the User-Agent or user metadata to provide better security context.

#### 10.4.2 Channel Prioritization Logic
The system evaluates user metadata (Country, FCM Tokens, Phone, Email) to select the optimal delivery path:
1.  **Direct-to-App (WebSocket)**: Highest priority for active sessions.
2.  **SMS (Primary Fallback)**: Prioritized for all users if a phone number is available, ensuring delivery in low-data environments.
3.  **Push Notifications (Secondary Fallback)**: Used if an FCM token is present.
4.  **WhatsApp (Enterprise)**: Used for high-priority transactional alerts in supported regions.
5.  **Email (Tertiary Fallback)**: Used for long-form regulatory communications or when other channels are unavailable.

### 10.5 System Monitoring & Operational Alerts
**File**: `/backend/infrastructure/MonitoringService.ts`

The `MonitoringService` provides real-time visibility into the health and performance of the ORBI platform.

#### 10.5.1 Real-Time Alerting
Critical system alerts (e.g., service failures, security breaches, high-risk anomalies) are dispatched using the `MessagingService`.
- **Admin Notifications**: Alerts are sent directly to system administrators' apps via WebSockets for immediate action.
- **Fallback Alerts**: If admins are offline, alerts are routed via SMS and Email to the configured `ADMIN_ALERT_PHONE` and `ADMIN_ALERT_EMAIL`.

#### 10.5.2 Transactional Auditing
All sensitive actions and system events are logged to the `Audit` table, including the `refId` and `deviceName` associated with the event. This allows for comprehensive post-mortem analysis and regulatory reporting.

## 11. Sandbox & Testing

To facilitate development and testing of real transaction flows, a Sandbox Faucet endpoint is available. This allows developers to fund test wallets with "demo" currency to simulate transfers, bill payments, and other financial operations.

### 11.1 Fund Wallet (Faucet)
**Endpoint**: `POST /v1/sandbox/fund`
**Auth**: Required (Bearer Token)

**Request Body**:
```json
{
  "userId": "uuid-of-user-to-fund",
  "amount": 50000,
  "currency": "TZS",
  "walletId": "optional-uuid-of-specific-wallet" 
}
```
*Note: `userId` is required. If `walletId` is omitted, the system automatically funds the user's primary `OPERATING` vault.*

**Response**:
```json
{
  "success": true,
  "message": "Successfully funded wallet with 50000 TZS",
  "data": {
    "transaction": { ... }
  }
}
```

### 11.2 Testing Scenarios
1.  **Insufficient Funds**: Use the Faucet to fund a wallet with a small amount (e.g., 1000 TZS), then attempt a transfer of a larger amount (e.g., 5000 TZS) to verify the `INSUFFICIENT_FUNDS` error.
2.  **Fee Calculation**: Fund a wallet with exactly the transfer amount, then attempt the transfer. The Preview endpoint should show the shortfall due to fees.
3.  **Success Flow**: Fund a wallet with `Amount + Fees`, then complete the transfer.

### 11.3 Account Activation (Sandbox Only)
If you encounter `SECURITY_BLOCK` errors related to "Primary identity node must be in ACTIVE state", your sandbox user account may not be fully activated. Use this endpoint to force activation.

**Endpoint**: `POST /v1/sandbox/activate`
**Auth**: Required (Bearer Token)

**Request Body**:
```json
{
  "userId": "uuid-of-user-to-activate" 
}
```
*Note: `userId` is required.*

## 12. Legacy API Gateway
For backward compatibility with older Orbi clients, the platform provides a unified POST gateway.

**Endpoint**: `POST /api?operation={OP_NAME}`
**Auth**: Required (Bearer Token)

### 12.1 Supported Operations
| Operation | Description |
| :--- | :--- |
| `escrow_create` | Create a new escrow agreement. |
| `escrow_release` | Release funds from an escrow. |
| `escrow_dispute` | Dispute an escrow transaction. |
| `treasury_withdraw` | Request a treasury withdrawal. |
| `treasury_approve` | Approve a treasury withdrawal. |
| `strategy_goal_list` | List user goals. |
| `strategy_task_list` | List user strategic tasks. |
| `enterprise_org_create` | Create a new organization. |

---

## 13. Advanced Error Resolution

| Error Code | Recommended UX Action |
| :--- | :--- |
| `SENTINEL_BLOCK` | Show "Security Alert" and prompt user to contact support. Do not retry. |
| `IDENTITY_LOCKED` | Inform user their account is frozen for security. |
| `KYC_LIMIT_EXCEEDED` | Navigate user to the KYC Upgrade screen. |
| `AUTH_THROTTLED` | Show a countdown timer before allowing another login attempt. |
| `EXECUTION_FAULT` | Show "System Maintenance" and provide a "Retry" button. |

## 14. Orbi TrustBridge (Conditional Escrow)
The **TrustBridge** allows for secure P2P commerce. Funds are locked in the sender's PaySafe vault and only released when conditions are met.

**Create Escrow Payload:**
```json
{
  "recipientCustomerId": "CUST-123",
  "amount": 50000,
  "description": "Payment for iPhone 13",
  "conditions": {
    "type": "DELIVERY_CONFIRMATION",
    "provider": "BOLT_LOGISTICS"
  }
}
```

---

## 15. Operational Ecosystem
For deep technical details on treasury management, external linked wallets, and forensic audit trails, please refer to the **[ORBI Operational Architecture & Ecosystem Guide](./ORBI_OPERATION.md)**.

---

**ORBI Financial Technologies Ltd.**  
*Engineering Division - Sovereign Core Team*

