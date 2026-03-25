# Multi-Tenant Merchant Architecture

**Classification**: INSTITUTIONAL / CORE ARCHITECTURE  
**Version**: 1.1.0  
**Last Updated**: 2026-03-24

---

## 1. Executive Summary
The **Multi-Tenant Merchant Architecture** allows a public identity with the `MERCHANT` role to own and operate one or more merchant businesses. The platform still models the merchant business as a distinct entity linked to an owner, which enables Marketplaces, Payment Gateways, and Business Accounts without collapsing business identity into a single wallet record.

This now sits alongside the public `AGENT` role:
- `MERCHANT`: payment acceptance / business operations
- `AGENT`: cash deposit / withdrawal field operations

Both flows still use the same canonical banking core:
- `transactions`
- `financial_ledger`
- double-entry posting
- immutable audit trail
- reconciliation and fraud controls

What changes is the operational interpretation. Merchant activity is treated as business payment acceptance. Agent activity is treated as service-operator cash activity. Consumer transfers remain ordinary retail movement.

---

## 2. Core Entities

### 2.1 Merchants (`merchants` table)
The core entity representing a business.
- **`id`**: Unique UUID.
- **`business_name`**: The name of the business.
- **`owner_user_id`**: Links back to the `users` table. A single user can own multiple merchants.
- **`status`**: `pending`, `active`, `suspended`, `closed`.

### 2.2 Merchant Wallets (`merchant_wallets` table)
Each merchant has its own operational wallet projection while still settling through the canonical wallet and ledger engine.
- **`merchant_id`**: Links to the `merchants` table.
- **`owner_user_id`**: Links back to the merchant actor in `users`.
- **`base_wallet_id`**: The canonical wallet backing the merchant projection.
- **`wallet_type`**: Operating / reserve / settlement-style classification.
- **`balance`**: The current balance of the merchant.
- **`currency`**: Default is `TZS`.

### 2.3 Merchant Settlements (`merchant_settlements` table)
Configuration for how and when the merchant receives payouts.
- **`merchant_id`**: Links to the `merchants` table.
- **`bank_name`**: The destination bank.
- **`bank_account`**: The destination account number.
- **`settlement_schedule`**: `daily`, `weekly`, or `manual`.

### 2.4 Merchant Fees (`merchant_fees` table)
Custom fee configurations for each merchant.
- **`merchant_id`**: Links to the `merchants` table.
- **`transaction_fee_percent`**: Percentage fee per transaction (e.g., `0.01` for 1%).
- **`fixed_fee`**: A fixed flat fee per transaction.

### 2.5 Merchant Transactions (`merchant_transactions` table)
Merchant operations are treated separately from normal consumer activity without breaking the canonical ledger model.
- **`transaction_id`**: Links to the authoritative transaction row.
- **`merchant_id`**: Merchant business owner context.
- **`merchant_wallet_id`**: Merchant wallet projection used for reporting.
- **`customer_user_id`**: The customer involved in the operation.
- **`service_type`**: Merchant payment subtype.
- **`status`**: Mirrors the authoritative transaction lifecycle.

### 2.6 Sponsored Customers (`service_actor_customer_links` table)
Merchants and agents can onboard consumers directly.
- Stores the actor who registered the customer.
- Preserves visibility for support, audit, and commercial attribution.
- Agent-sponsored rows may also activate time-bounded commission eligibility.

---

## 3. API Endpoints

All endpoints are protected and require a valid user session.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/v1/merchants/accounts` | Create a new Merchant Account. |
| `GET` | `/v1/merchants/accounts/my` | List all Merchant Accounts owned by the current user. |
| `GET` | `/v1/merchants/accounts/:id` | Get detailed information about a specific Merchant Account. |
| `PATCH` | `/v1/merchants/accounts/:id/settlement` | Update the settlement configuration (bank details, schedule). |
| `GET` | `/v1/merchant/transactions` | List merchant-context transactions for the authenticated merchant actor. |
| `GET` | `/v1/merchant/wallets` | List merchant operational wallet projections. |
| `POST` | `/v1/merchant/customers/register` | Register a new consumer from a merchant service node. |
| `GET` | `/v1/merchant/customers` | List customers registered by the current merchant actor. |
| `POST` | `/v1/merchant/payments/preview` | Preview a merchant-context payment flow. |
| `POST` | `/v1/merchant/payments/settle` | Execute a merchant-context payment flow. |

---

## 4. Transaction Flow

When a customer pays a merchant:
1. **Customer Wallet** -> `DEBIT`
2. **Payment Processor** -> Handles routing and fee calculation.
3. **Merchant Wallet** -> `CREDIT` (Pending or Available balance).
4. **Settlement Engine** -> Sweeps funds to the Merchant's Bank Account based on the `settlement_schedule`.

Merchant-context transactions are tagged with:
- `metadata.service_context = "MERCHANT"`

This lets audit, reporting, and operator tooling distinguish merchant operations from normal consumer P2P transfers while keeping the real money movement in the same double-entry immutable ledger.

## 5. How Merchant Payments Differ From Normal Transfers

Normal consumer transfer:
- personal retail movement
- no merchant operating projection
- no merchant settlement reporting layer

Merchant payment:
- business/payment acceptance activity
- projected to `merchant_transactions`
- visible through `merchant_wallets`
- can be settled and supported as merchant business activity

The merchant model does not replace the normal ledger. It adds a merchant business view on top of the same ledger-safe transaction flow.

## 6. Agent and Commission Relationship

The merchant stack now coexists with the `AGENT` service actor model:
- `AGENT` handles cash deposit and withdrawal operations.
- `MERCHANT` handles payment acceptance and business wallet operations.
- Both can register consumers into the platform.
- Only active agent sponsorship links participate in referral commission payout by default.

### Commission Summary

Current commission support is agent-focused:
- direct agent cash deposit / withdrawal activity can create `AGENT_CASH` commissions
- active agent-sponsored consumers can create `AGENT_REFERRAL` commissions
- commission business records live in `service_commissions`
- payout is booked as a separate canonical ledger-backed transaction with `service_context = "SERVICE_COMMISSION"`

This means commission remains auditable in two layers:
- business layer: `service_commissions`
- financial layer: `transactions` + `financial_ledger`
