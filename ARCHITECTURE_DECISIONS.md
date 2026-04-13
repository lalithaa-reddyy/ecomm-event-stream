# Architecture Decisions: Event Generation Strategy

## Current Architecture (Demo/Testing Phase)

```
Frontend (React)
    ↓
    POST /stream API (lambda-based)
    ↓
Lambda: generateAndIngestBatch()
    ↓
    Generates synthetic e-commerce events
    ↓
    Writes to S3 as Parquet files
    ↓
Dashboard: Reads and visualizes data
```

---

## Why Lambda Generates Events (Not Frontend + Kinesis)?

### 1. **Phase of Development**
- ✅ **Current Phase:** Demo/Testing Pipeline
- Current Goal: Validate data aggregation, Parquet format, dashboard visualization
- Not Testing: Real event ingestion at scale

### 2. **Cost Efficiency**
```
Current (Lambda Generation):
  - Lambda invocations only when "Start Stream" clicked
  - No always-on infrastructure
  - Estimated cost: ~$0.0001/1M events

Frontend + Kinesis (Production):
  - Kinesis shard: $0.30/hour (continuous)
  - Lambda consumer: $0.20/1M invocations
  - CloudWatch logs: Additional cost
  - Estimated cost: $7.20/day minimum + processing
```

### 3. **Simplicity & Focus**
```
Lambda Generation approach:
✅ Single API call to trigger
✅ Deterministic output (10k events/min = exactly 10k)
✅ Easy to control volume for testing
✅ One point of failure to debug
✅ No distributed system complexity

Frontend + Kinesis approach:
❌ Frontend must generate events
❌ Kinesis queue management
❌ Lambda consumer setup
❌ Error handling across 3 layers
❌ Potential data loss/duplication
```

### 4. **Volume Control**
```
Lambda:
  Rate = precisely controlled
  "Start with 10,000 events/minute" → exactly 10,000
  Perfect for reproducible testing

Frontend + Kinesis:
  Rate = unpredictable
  Browser performance dependent
  Network latency variable
  Hard to test consistently
```

### 5. **Demo Requirements Met**
```
Testing Goals:              ✅ Met by current approach
- Weighted segments         ✅ Lambda generates correctly
- Parquet format S3         ✅ Lambda writes Parquet
- Dashboard aggregation     ✅ Displays from S3 data
- Anomaly injection         ✅ Works via API

NOT Testing (Not needed now):
❌ Real event collection at scale
❌ Kinesis reliability
❌ Frontend event SDK integration
```

---

## Production Migration Path (Future)

When you move to production with **real users**, migrate to:

```
User Actions on Frontend (Real)
    ↓
    Frontend Event SDK
    ↓
    Kinesis Data Stream (10k+ events/sec capacity)
    ↓
    Lambda: Consumes stream records
    ↓
    Validates, enriches, formats
    ↓
    S3 (Parquet files)
    ↓
    Analytics Pipeline
```

### Production Advantages:
- ✅ Events from actual user behavior
- ✅ Auto-scaling with demand
- ✅ Proper load distribution
- ✅ Industry standard pattern
- ✅ Kinesis deduplication built-in

---

## Comparison Table

| Aspect | Lambda Generation (Demo) | Frontend + Kinesis (Production) |
|--------|--------------------------|--------------------------------|
| **Cost** | ~$0.01/day | ~$7.20/day min |
| **Setup** | Simple (1 API) | Complex (3 components) |
| **Control** | Deterministic | Variable |
| **Scale** | Limited to Lambda timeout | Unlimited (auto-scaling) |
| **Use Case** | Demo/Testing ✅ | Production ✅ |
| **Data Volume** | Fixed rate | User-driven |
| **Implementation** | 20 minutes | 2-3 days |
| **Test Duration** | Hours | Continuous |

---

## Architecture Decision Rationale

### ✅ Why We Chose Lambda Generation:

1. **Optimal for Testing Phase**
   - Quickly validate pipeline
   - Reproducible results
   - Easy debugging

2. **Cost-Effective**
   - No always-on infrastructure
   - Pay only for usage
   - Perfect for POC

3. **Focused Testing**
   - Tests aggregation logic ✅
   - Tests Parquet format ✅
   - Tests dashboard ✅
   - NOT testing ingestion (scope out of current phase)

4. **Time to Market**
   - Deploy in days, not weeks
   - Stakeholder demo ready quickly
   - Proof of concept complete

### ❌ Why Not Frontend + Kinesis (Now)?

1. **Premature Infrastructure**
   - Adding cost with no users
   - Added complexity not yet needed
   - Infrastructure for 100 users is wasteful

2. **Unclear Requirements**
   - Event schema not finalized
   - Event rate unpredictable
   - User patterns unknown

3. **Testing Focus**
   - Would test Kinesis reliability (not goal)
   - Would test frontend event SDK (not goal)
   - Would add 2 weeks to timeline

---

## Migration Checklist (When Moving to Production)

- [ ] Define event schema with product team
- [ ] Set up Kinesis stream
- [ ] Build frontend event SDK
- [ ] Implement consumer Lambda
- [ ] Add DLQ for failed events
- [ ] Set up monitoring/alerting
- [ ] Load test with realistic data
- [ ] Plan gradual migration from demo → production

---

## Timeline

```
PHASE 1: Demo/Testing (Current) ← YOU ARE HERE
├─ Lambda generates events
├─ Duration: 1-2 months
└─ Goal: Validate pipeline design

PHASE 2: Beta/Small Scale (Q3 2026)
├─ Real users (< 1000)
├─ Still Lambda generation
├─ Monitor actual event patterns
└─ Goal: Understand real data

PHASE 3: Production (Q4 2026)
├─ Migrate to Frontend + Kinesis
├─ Real users (1000+)
└─ Goal: Full production system
```

---

## How to Explain This in a Meeting

**"We're currently in the **demo/testing phase** where we're validating the core pipeline:"**

1. **Justification**
   - "Lambda generation lets us test aggregations, Parquet format, and dashboards without infrastructure overhead"
   - "We achieve deterministic, reproducible testing with minimal cost"

2. **Migration Plan**
   - "When we move to production with real users, we'll implement Frontend + Kinesis for proper event streaming"
   - "This gives us auto-scaling and event-driven architecture"

3. **Not Skipping Steps**
   - "We're not avoiding best practices; we're following them for each phase"
   - "Building complex infrastructure before validating requirements would be waste"

4. **Cost/Time Trade-off**
   - "Current approach: $0.01/day, 2-week implementation, all testing goals met"
   - "Alternative approach: $7+ /day, 4-week implementation, tests unnecessary components"

---

## Conclusion

**Lambda event generation is the RIGHT choice for this phase because:**
- ✅ Aligns with development phase (testing, not production)
- ✅ Costs 700x less than production architecture
- ✅ Delivers value faster
- ✅ Tests what matters now (pipeline logic)
- ✅ Clear migration path when requirements change

This is **pragmatic architecture**, not corner-cutting.
