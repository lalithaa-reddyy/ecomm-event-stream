# Deduplication Logic

## Overview

The Stream Lambda function includes built-in deduplication logic to prevent duplicate event processing. This is critical for:

- **Idempotency**: Handling Lambda retry scenarios where the same request is processed multiple times
- **Replay Prevention**: Detecting and rejecting duplicate anomaly submissions
- **Data Integrity**: Ensuring each unique event is counted only once in aggregations

## How It Works

### Event Tracking

Both regular events and batch operations are tracked in a DynamoDB deduplication table:

1. **Anomaly Events**: Each anomaly POST receives a unique `eventId` on the first call to `processIncoming()`
   - If the same `eventId` is submitted again, the function detects it as a duplicate and returns `isDuplicate: true`
   - No processing occurs for duplicate anomalies

2. **Batch Events**: Each batch generation gets a `batchId`
   - If `generateAndIngestBatch()` is retried with the same `batchId`, it detects the duplicate
   - No re-ingestion of events occurs

### TTL Cleanup

All processed events are automatically cleaned up after **24 hours** using DynamoDB's Time-to-Live (TTL) feature:

- `ttl` attribute set to `now + 86400 seconds`
- DynamoDB automatically removes expired records
- Reduces storage costs and prevents unbounded table growth

## Setup Instructions

### 1. Create the Deduplication Table

Create a DynamoDB table for tracking processed events:

```bash
aws dynamodb create-table \
  --table-name event-dedup \
  --attribute-definitions \
    AttributeName=eventId,AttributeType=S \
  --key-schema \
    AttributeName=eventId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --time-to-live-specification \
    AttributeName=ttl,Enabled=true
```

**Table Configuration:**
- **Table Name**: `event-dedup` (or your preferred name)
- **Partition Key**: `eventId` (String)
- **Billing Mode**: PAY_PER_REQUEST (scales automatically)
- **TTL Attribute**: `ttl` (auto-cleanup enabled)

### 2. Configure Environment Variables

Set the following environment variable in your Lambda function configuration:

```
DEDUP_TABLE=event-dedup
```

**Optional**: If `DEDUP_TABLE` is not set, deduplication is skipped with a warning log but processing continues.

### 3. Update IAM Permissions

Ensure your Lambda execution role has permissions for the dedup table:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:REGION:ACCOUNT:table/event-dedup"
    }
  ]
}
```

## Response Format

### Duplicate Detection Result

When a duplicate is detected, the response includes:

```json
{
  "eventId": "uuid-string",
  "eventType": "ANOMALY",
  "timestamp": "2026-04-10T15:30:45.123Z",
  "payload": { /* original payload */ },
  "isDuplicate": true,
  "message": "Event already processed"
}
```

### Normal Processing Result

For new, non-duplicate events:

```json
{
  "eventId": "uuid-string",
  "eventType": "ANOMALY",
  "timestamp": "2026-04-10T15:30:45.123Z",
  "payload": { /* original payload */ }
}
```

## Implementation Details

### `isEventProcessed(eventId)`

- Checks if an event has been processed before
- Uses atomic `UpdateCommand` with `if_not_exists()` to prevent race conditions
- **Returns**: `true` if duplicate, `false` if new
- **Fails open**: If DEDUP_TABLE is unavailable, returns `false` and logs warning

### Batch-Level Deduplication

- Batch events are tracked with key `batch#{batchId}`
- Prevents re-ingestion of the same batch during Lambda retries
- Returns `isDuplicate: true` on retry attempts

### Event ID Prefixes

- **Anomalies**: `eventId` (plain UUID)
- **Batch operations**: `batch#{batchId}` (prefixed to namespace them separately)

## Performance Considerations

- **DynamoDB Throughput**: Uses on-demand billing to handle variable traffic
- **Latency**: Single UpdateCommand per event (~10-20ms)
- **Cost**: Minimal - only writes to one table, auto-cleanup reduces storage
- **Scalability**: No bottlenecks; partition key ensures even distribution

## Monitoring

Check deduplication activity:

```bash
# View dedup table item count
aws dynamodb scan --table-name event-dedup \
  --select COUNT \
  --return-consumed-capacity TOTAL

# Check for duplicate detections in logs
aws logs tail /aws/lambda/StreamFunction --follow | grep "Duplicate"
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Deduplication not working | Verify `DEDUP_TABLE` env var is set correctly |
| DynamoDB ProvisionedThroughputExceededException | Switch to PAY_PER_REQUEST billing mode |
| Dedup table growing too large | Verify TTL is enabled on `ttl` attribute |
| Duplicate events still appearing | Ensure all Lambda invocations use same table name |

## Future Enhancements

- [ ] Implement request-level idempotency keys for HTTP POSTs
- [ ] Add metrics/CloudWatch alarms for duplicate detection rate
- [ ] Implement sliding window deduplication for high-volume scenarios
- [ ] Add optional dedup for generated batch events (currently batch-level only)
