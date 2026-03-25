# ORBI Mobile SDK Developer Guide (v30.0)
**SDK Version**: 30.0.0-stable  
**Last Updated**: 2026-03-14
**Environment**: Production

---

## 1. Getting Started

The **ORBI Mobile SDK** connects your application to the **Sovereign Backend Node**. It handles authentication, secure storage, and real-time ledger synchronization.

### 1.1 Base Configuration
*   **API Endpoint**: `https://orbi-financial-technologies-c0re-v2026.onrender.com`
*   **WebSocket Endpoint**: `wss://orbi-financial-technologies-c0re-v2026.onrender.com/nexus-stream`
*   **App Identity**: You must include `x-orbi-app-id`, `x-orbi-app-origin`, and `x-orbi-apk-hash` (for Android) in every request. Consumer/mobile builds use `mobile-android` or `mobile-ios` with `ORBI_MOBILE_V2026`; institutional/core builds use `OBI_INSTITUTIONAL_CORE_V25` or `DPS_INSTITUTIONAL_CORE_V25` with the matching origin.

---

## 2. Authentication Flow

### 2.1 User Registration (Onboarding)
**Endpoint**: `POST /v1/auth/signup`

Use this to create a new user account. The backend handles ID generation and vault provisioning.

**Code Example (TypeScript/React Native)**:
```typescript
const registerUser = async (userData) => {
  const payload = {
    email: userData.email,
    password: userData.password,
    full_name: userData.fullName,
    phone: userData.phone, // E.164 format: +255...
    nationality: "Tanzania",
    currency: "TZS",
    metadata: {
      app_origin: "ORBI_MOBILE_V2026" // REQUIRED: Identifies this as a Mobile User
    }
  };

  const response = await api.post('/v1/auth/signup', payload);
  if (response.data.success) {
    // Auto-login or redirect to verification
    const { user, session } = response.data.data;
    await SecureStore.save('jwt', session.access_token);
  }
};
```

**Note**: `customer_id` is automatically generated (e.g., `OB26-1234-5678`) if you don't send it. The format is `FN{YY}-{RAND4}-{RAND4}`.
Legacy note: `OBI_MOBILE_V1` is still accepted by older auth paths for backward compatibility, but new consumer/mobile clients should use `ORBI_MOBILE_V2026`.

### 2.2 Login & Session Management
**Endpoint**: `POST /v1/auth/login`

**Code Example**:
```typescript
const login = async (email, password) => {
  const response = await api.post('/v1/auth/login', { e: email, p: password });
  const { session, biometric_setup_required } = response.data.data;
  
  // Store session securely
  await SecureStore.save('jwt', session.access_token);
  await SecureStore.save('user_id', session.user.id);

  // NEW: Check for mandatory biometric setup
  if (biometric_setup_required) {
    // Redirect to Biometric Registration Screen
    navigation.navigate('BiometricSetup');
  } else {
    navigation.navigate('Dashboard');
  }
};
```

### 2.3 Profile Sync & Updates
**Endpoints**: 
*   `GET /v1/user/profile`: Fetch current status.
*   `PATCH /v1/user/profile`: Update preferences (language, notifications).

**Code Example (Updating Preferences)**:
```typescript
const updatePreferences = async (language, notifs) => {
  const response = await api.patch('/v1/user/profile', {
    language: language, // 'en' or 'sw'
    notif_security: notifs.security,
    notif_financial: notifs.financial,
    notif_budget: notifs.budget,
    notif_marketing: notifs.marketing
  });
  return response.data.success;
};
```

### 2.4 Avatar Upload
**Endpoint**: `POST /v1/user/avatar`

Upload a profile picture. Supports raw binary, `multipart/form-data` (field name: `file`), or base64 JSON.

**Code Example (React Native - Multipart)**:
```typescript
const uploadAvatar = async (imageUri) => {
  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'avatar.jpg',
  });

  const response = await fetch('https://orbi-financial-technologies-c0re-v2026.onrender.com/v1/user/avatar', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData
  });
  
  const result = await response.json();
  return result.data.avatar_url;
};
```

---

## 3. Wallet & Payments

### 3.1 Fetching Wallets
**Endpoint**: `GET /v1/wallets`

Displays the user's **Sovereign Vault** (System) and any linked Mobile Money/Bank accounts.

**PaySafe Vault Metadata**:
The primary vault (name: `"PaySafe"`) contains critical metadata for UI rendering:
- `metadata.card_type`: `"Virtual Master"`
- `metadata.product_name`: `"PaySafe"`
- `metadata.linked_customer_id`: The user's institutional ID.
- `metadata.display_name`: The owner's name.

### 3.2 Making a Payment (Atomic Settlement)
**Endpoint**: `POST /v1/transactions/settle`

**Note**: For internal and peer transfers, the backend now automatically triggers settlement upon successful processing. You do not need to call a separate settlement endpoint after the transaction is processed.

**Recommendation**: Always call the **Transaction Preview** (Section 3.4) before calling settle. This ensures the user sees the final fee and confirms the recipient's name.

**Critical**: You MUST generate a unique UUID v4 for `x-idempotency-key` to prevent double-charging if the network flakes.

**Code Example**:
```typescript
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

const sendMoney = async (amount, recipientCustomerId) => {
  const idempotencyKey = uuidv4();
  
  try {
    const response = await api.post('/v1/transactions/settle', {
      type: 'PEER_TRANSFER',
      amount: amount,
      sourceWalletId: myWalletId,
      recipient_customer_id: recipientCustomerId, // Use Customer ID for internal transfers
      description: "Payment for services"
    }, {
      headers: { 'x-idempotency-key': idempotencyKey }
    });
    
    return response.data;
  } catch (error) {
    if (error.response.status === 409) {
      console.warn("Transaction already processed");
    }
  }
};
```

### 3.3 KYC Verification (Identity)
...
...
...
Call `GET /v1/user/kyc/status` or listen for `KYC_UPDATE` events via WebSocket.

### 3.4 Transaction Preview (Pre-Flight)
**Endpoint**: `POST /v1/transactions/preview`

Use this to simulate a transaction. It returns the fee breakdown and recipient profile without moving any money.

**Code Example**:
```typescript
const previewTransaction = async (amount, recipientId) => {
  const response = await api.post('/v1/transactions/preview', {
    recipient_customer_id: recipientId,
    amount: amount,
    currency: 'TZS',
    type: 'PEER_TRANSFER',
    description: 'Dinner'
  });
  
  const { breakdown, metadata } = response.data.data;
  // breakdown: { base, tax, fee, total }
  // metadata.receiver_details.profile: { full_name, avatar_url, customer_id }
  
  return { breakdown, profile: metadata.receiver_details.profile };
};
```

### 3.5 User Lookup (Recipient Search)
**Endpoint**: `GET /v1/user/lookup?q={query}`

Search for recipients by email, phone number, or Customer ID.

**Code Example**:
```typescript
const searchRecipient = async (query) => {
  if (query.length < 3) return [];
  
  const response = await api.get(`/v1/user/lookup?q=${encodeURIComponent(query)}`);
  return response.data.data; // Array of UserPublicProfile: { id, full_name, avatar_url, customer_id }
};
```

---

## 4. Real-Time Updates (Nexus Stream)

Connect to the WebSocket to update the UI instantly when money arrives or leaves.

**Implementation**:
```typescript
const ws = new WebSocket('wss://orbi-financial-technologies-c0re-v2026.onrender.com/nexus-stream');

ws.onopen = () => {
  console.log('Connected to Nexus');
  // Authenticate the socket
  ws.send(JSON.stringify({ type: 'AUTH', token: myJwtToken }));
};

ws.onmessage = (e) => {
  const event = JSON.parse(e.data);
  
  if (event.type === 'SETTLEMENT_CONFIRMED') {
    // Refresh wallet balance
    refreshWallets();
    showNotification(`Received ${event.amount} ${event.currency}`);
  }
};
```

---

## 5. Security & App Trust

To protect the Sovereign Node from unauthorized clients, the backend enforces **App Trust Verification**.

### 5.1 Mandatory Request Headers
Every request from the official Android app must include the following headers:

*   `x-orbi-app-id`: Identifies the client cluster (e.g., `mobile-android` or `mobile-ios`).
*   `x-orbi-app-origin`: Identifies the application origin (e.g., `ORBI_MOBILE_V2026`).
*   `x-orbi-apk-hash`: The **Base64-encoded SHA-256 fingerprint** of your Android signing certificate. Android requests must include it; iOS requests should not.

Requests from Android without these headers (or with a mismatching hash) are rejected with `403 Forbidden`.

### 5.2 Android SMS Retriever
For seamless OTP auto-reading, the backend appends an 11-character hash to the end of every SMS. 
*   **App Side**: Use the `SmsRetrieverClient` to listen for messages.
*   **Hash**: Ensure the hash generated by your app matches the `ORBI_ANDROID_SMS_HASH` configured on the server.

### 5.3 Biometrics & Passkeys
When performing biometric authentication, the Android OS automatically attaches the app's hash to the request origin. The backend validates this against the `ORBI_ANDROID_APP_HASH`.

1.  **Origin Validation**: The backend extracts the `origin` from the `clientDataJSON`.
2.  **Format**: For Android, this must be `android:apk-key-hash:<BASE64_HASH>`.
3.  **RP ID Pinning**: The Relying Party ID (`rpID`) is pinned to a canonical value (e.g., your production domain) to prevent domain-spoofing.
4.  **Fail-Closed**: If the origin is missing or incorrect during biometric completion, the request is rejected with `403 Forbidden`.

---

## 6. Security Best Practices

1.  **SSL Pinning**: Pin the server certificate to prevent Man-in-the-Middle attacks.
2.  **Official App Verification**: Android REST calls must include the `x-orbi-apk-hash` header. iOS clients should rely on the trusted mobile app identity headers instead.
3.  **Biometrics**: Use local biometrics (FaceID/TouchID) to guard the `access_token`.
4.  **Root Detection**: The API may reject requests from rooted/jailbroken devices (Sentinel Check).
5.  **Rate Limiting**: Do not poll endpoints. Use WebSockets for updates.

## 7. Troubleshooting & Common Errors

### 6.1 Type Error: `type 'Map<String, dynamic>' is not a subtype of type 'String'`

**Cause**: This error occurs in Dart/Flutter when you try to save a JSON object (Map) directly to `SharedPreferences` or `FlutterSecureStorage`, which expect a `String`.

**Solution**: You must `jsonEncode()` the object before saving it.

**Incorrect**:
```dart
// ❌ Crashes because user is a Map
await storage.write(key: 'user_profile', value: response['data']['user']);
```

**Correct**:
```dart
import 'dart:convert';

// ✅ Encodes Map to String first
await storage.write(key: 'user_profile', value: jsonEncode(response['data']['user']));
```

### 6.2 HTTP 400 Bad Request (Validation)

**Cause**: Sending fields that don't match the schema (e.g., missing `email` or `password`).
**Solution**: Ensure you are sending `email` and `password` (or `e` and `p`).

---

**ORBI Mobile Engineering**

