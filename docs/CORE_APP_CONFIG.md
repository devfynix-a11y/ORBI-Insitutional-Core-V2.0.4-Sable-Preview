# Core App Configuration Guide

This guide provides the specific connection endpoints and configuration parameters required to connect the Core App (Institutional/Admin Client) to the ORBI Sovereign Backend.

## 1. Environment Configuration

### Production (Pre-Release)
Use these settings for the live staging environment.

*   **App Name**: `ORBI Core [PRE]`
*   **Base URL**: `https://orbi-financial-technologies-c0re-v2026.onrender.com`
*   **WebSocket URL**: `wss://orbi-financial-technologies-c0re-v2026.onrender.com/nexus-stream`
*   **Environment ID**: `production-pre`

### Development (Sandbox)
Use these settings for testing and integration.

*   **App Name**: `ORBI Core [DEV]`
*   **Base URL**: `https://orbi-financial-technologies-c0re-v2026.onrender.com`
*   **WebSocket URL**: `wss://orbi-financial-technologies-c0re-v2026.onrender.com/nexus-stream`
*   **Environment ID**: `development`

## 2. Required Headers

The Core App must include the following headers in **every** request to pass the WAF and RBAC checks:

| Header | Value | Description |
| :--- | :--- | :--- |
| `x-orbi-app-id` | `OBI_INSTITUTIONAL_CORE_V25` | **CRITICAL**: Identifies the client as the Core App. |
| `x-orbi-app-origin` | `OBI_INSTITUTIONAL_CORE_V25` | **CRITICAL**: Identifies the institutional application origin. |
| `x-orbi-trace` | `{UUID}` | Unique request ID for tracing. |
| `Content-Type` | `application/json` | Standard payload format. |
| `Authorization` | `Bearer {JWT}` | Admin/Staff session token. |
| `x-orbi-apk-hash` | `Base64 Hash` | **MANDATORY**: For identifying the official Android app. |

## 3. Feature Flags

Enable the following flags in the Core App configuration to support the new Staged Settlement flow:

```json
{
  "features": {
    "enable_staged_settlement": true,
    "enable_realtime_nexus": true,
    "enable_biometric_admin_auth": true,
    "transaction_timeout_ms": 300000 // 5 minutes (matches backend reaping)
  }
}
```

## 4. Key Endpoints for Core Operations

*   **Global Transaction Stream**: `GET /v1/admin/transactions`
*   **User Management**: `GET /v1/user/lookup?q={query}`
*   **KYC Review Queue**: `POST /v1/admin/kyc/review`
*   **System Health**: `GET /v1/sys/metrics`

---
**Note**: The backend trust layer now accepts both consumer-mobile and institutional/core app identities. Core/admin surfaces should use `OBI_INSTITUTIONAL_CORE_V25` (or `DPS_INSTITUTIONAL_CORE_V25`) consistently with the matching `x-orbi-app-origin`.

