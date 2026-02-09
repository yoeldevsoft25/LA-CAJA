
# Federation & Split Brain Remediation API

## Authentication
All endpoints require a Bearer Token with the `admin` role or `ADMIN_SECRET` environment key for relay operations.

---

## 1. Health Monitoring

### Get Current Health Status
`GET /sync/federation/health?store_id={uuid}`

**Description**: returns real-time metrics of federation sync status, including projection gaps, event lag, and connected services.

**Response**: (200 OK)
```json
{
  "timestamp": "2026-02-09T18:00:00.000Z",
  "storeId": "692e106b-...",
  "overallHealth": "healthy",
  "metrics": {
    "eventLagCount": 0,
    "projectionGapCount": 0,
    "stockDivergenceCount": 0,
    "negativeStockCount": 0,
    "queueDepth": 3,
    "failedJobs": 0,
    "remoteReachable": true,
    "remoteLatencyMs": 45,
    "circuitBreakerState": "CLOSED" 
  }
}
```

### Get Health History
`GET /sync/federation/health/history?store_id={uuid}&hours=24`

**Description**: Returns snapshots of health metrics stored every 5 minutes for the last N hours.

---

## 2. Fiscal Sequence Management

### Reserve Fiscal Range
`POST /fiscal/reserve-range`

**Description**: Reserves a range of fiscal sequence numbers for an offline device.

**Body**:
```json
{
  "store_id": "uuid",
  "series_id": "uuid",
  "device_id": "uuid",
  "quantity": 50
}
```

**Response**: (201 Created)
```json
{
  "device_id": "uuid",
  "range_start": 101,
  "range_end": 150,
  "expires_at": "2026-02-10T18:00:00.000Z"
}
```

---

## 3. Inventory Escrow

### Batch Grant Quota
`POST /inventory/escrow/batch-grant`

**Description**: Dynamically reserves stock quotas for a list of products (Prefetch).

**Body**:
```json
{
  "store_id": "uuid",
  "device_id": "uuid",
  "items": [
    { "product_id": "uuid", "qty": 5, "expires_at": "2026-02-09T22:00:00Z" }
  ]
}
```

---

## 4. Conflict Resolution & Auditing

### Get Conflict Audit Logs
`GET /sync/conflicts/audit?store_id={uuid}&from=2026-02-01&to=2026-02-28`

**Description**: Retrieves logs of conflict resolutions performed automatically by CRDT rules.

---

## 5. Operations

### Force Auto-Reconcile (Manual Trigger)
`POST /sync/federation/auto-reconcile`

**Description**: Triggers instantaneous reconciliation between local and remote nodes. Uses Distributed Lock.

**Body**:
```json
{
  "store_id": "uuid"
}
```
