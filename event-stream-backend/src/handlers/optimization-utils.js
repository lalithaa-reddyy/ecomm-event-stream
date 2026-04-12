/**
 * Optimized batch aggregation module
 * Single-pass calculation instead of 8 separate loops
 * Performance improvement: ~8x faster aggregation
 */

const crypto = require("crypto");

/**
 * Single-pass aggregation calculator
 * Processes all event dimensions in one loop instead of eight
 * 
 * @param events - array of event objects
 * @returns aggregations object with all dimension stats
 */
function calculateAggregationsOptimized(events) {
  const aggregations = {
    countsByMinute: {},
    catAgg: {},
    campaignAgg: {},
    deviceAgg: {},
    geoAgg: {},
    ageAgg: {},
    revenueAgg: {},
    anomalyAgg: {},
    segmentAgg: {}
  };

  // SINGLE LOOP - Process all events once
  for (const e of events) {
    // 1. Per-minute aggregations (timeline)
    const minute = e.timestamp.slice(0, 16);
    if (!aggregations.countsByMinute[minute]) {
      aggregations.countsByMinute[minute] = { total: 0 };
    }
    aggregations.countsByMinute[minute].total += 1;
    aggregations.countsByMinute[minute][e.eventType] = 
      (aggregations.countsByMinute[minute][e.eventType] || 0) + 1;

    // 2. Per-category aggregations
    const catKey = `cat#${e.product_category}`;
    if (!aggregations.catAgg[catKey]) aggregations.catAgg[catKey] = { total: 0 };
    aggregations.catAgg[catKey].total += 1;
    aggregations.catAgg[catKey][e.eventType] = 
      (aggregations.catAgg[catKey][e.eventType] || 0) + 1;
    if (e.orderValue > 0 && !e.isAnomaly) {
      aggregations.catAgg[catKey].revenue = 
        (aggregations.catAgg[catKey].revenue || 0) + e.orderValue;
    }

    // 3. Per-campaign aggregations
    const campaignKey = `campaign#${e.campaignId}`;
    if (!aggregations.campaignAgg[campaignKey]) aggregations.campaignAgg[campaignKey] = { total: 0 };
    aggregations.campaignAgg[campaignKey].total += 1;
    if (e.eventType === 'order' && !e.isAnomaly) {
      aggregations.campaignAgg[campaignKey].order_count = 
        (aggregations.campaignAgg[campaignKey].order_count || 0) + 1;
      aggregations.campaignAgg[campaignKey].revenue = 
        (aggregations.campaignAgg[campaignKey].revenue || 0) + e.orderValue;
    }

    // 4. Per-device aggregations
    const deviceKey = `device#${e.deviceType}`;
    if (!aggregations.deviceAgg[deviceKey]) aggregations.deviceAgg[deviceKey] = { total: 0 };
    aggregations.deviceAgg[deviceKey].total += 1;
    if (e.eventType === 'order') {
      aggregations.deviceAgg[deviceKey].order_count = 
        (aggregations.deviceAgg[deviceKey].order_count || 0) + 1;
    }

    // 5. Per-city aggregations
    const geoKey = `geo#${e.city}`;
    if (!aggregations.geoAgg[geoKey]) aggregations.geoAgg[geoKey] = { total: 0 };
    aggregations.geoAgg[geoKey].total += 1;
    if (e.eventType === 'order' && !e.isAnomaly) {
      aggregations.geoAgg[geoKey].order_count = 
        (aggregations.geoAgg[geoKey].order_count || 0) + 1;
      aggregations.geoAgg[geoKey].revenue = 
        (aggregations.geoAgg[geoKey].revenue || 0) + e.orderValue;
    }

    // 6. Per-age-group aggregations
    const ageKey = `age#${e.ageGroup}`;
    if (!aggregations.ageAgg[ageKey]) aggregations.ageAgg[ageKey] = { total: 0 };
    aggregations.ageAgg[ageKey].total += 1;
    aggregations.ageAgg[ageKey][e.eventType] = 
      (aggregations.ageAgg[ageKey][e.eventType] || 0) + 1;
    if (e.eventType === 'order' && !e.isAnomaly) {
      aggregations.ageAgg[ageKey].order_count = 
        (aggregations.ageAgg[ageKey].order_count || 0) + 1;
      aggregations.ageAgg[ageKey].revenue = 
        (aggregations.ageAgg[ageKey].revenue || 0) + e.orderValue;
    }

    // 7. Per-segment aggregations
    const segmentKey = `segment#${e.segment}`;
    if (!aggregations.segmentAgg[segmentKey]) aggregations.segmentAgg[segmentKey] = { total: 0 };
    aggregations.segmentAgg[segmentKey].total += 1;
    aggregations.segmentAgg[segmentKey][e.eventType] = 
      (aggregations.segmentAgg[segmentKey][e.eventType] || 0) + 1;

    // 8. Revenue summary (exclude anomalies)
    if (!e.isAnomaly) {
      aggregations.revenueAgg.total_revenue = 
        (aggregations.revenueAgg.total_revenue || 0) + e.orderValue;
      if (e.eventType === 'order') {
        aggregations.revenueAgg.order_count = 
          (aggregations.revenueAgg.order_count || 0) + 1;
      }
    }

    // 9. Anomaly summary
    if (e.isAnomaly) {
      aggregations.anomalyAgg.total_anomalies = 
        (aggregations.anomalyAgg.total_anomalies || 0) + 1;
      if (e.anomalyType) {
        aggregations.anomalyAgg[e.anomalyType] = 
          (aggregations.anomalyAgg[e.anomalyType] || 0) + 1;
      }
    }
  }

  return aggregations;
}

/**
 * Batch write helper for DynamoDB
 * Updates DynamoDB in batches of 25 items (25 items max per BatchWriteItem)
 * Performance: 25x fewer API calls vs sequential updates
 * 
 * @param ddbDoc - DynamoDB Document client
 * @param table - table name
 * @param items - array of items to write
 */
async function batchWriteItems(ddbDoc, table, items) {
  const { BatchWriteCommand } = require("@aws-sdk/lib-dynamodb");
  
  const BATCH_SIZE = 25;  // DynamoDB limit
  const batches = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const RequestItems = {
      [table]: batch.map(item => ({ Put: { ...item } }))
    };
    
    batches.push(
      ddbDoc.send(new BatchWriteCommand({ RequestItems }))
        .catch(err => {
          console.error(`Batch write failed for items ${i}-${i + BATCH_SIZE}:`, err.message);
          throw err;
        })
    );
  }

  return Promise.all(batches);
}

/**
 * Optimized update that prepares items for batch writing
 * Instead of sending updates individually, collects them and updates in bulk
 * 
 * @param aggregations - result from calculateAggregationsOptimized
 * @param table - table name
 */
function prepareItemsForBatchWrite(aggregations, table) {
  const items = [];

  // Helper to create DynamoDB items
  const createItem = (id, attributes) => ({
    TableName: table,
    Item: {
      id,
      ...attributes,
      lastUpdate: new Date().toISOString()
    }
  });

  // Per-minute aggregations
  for (const [minute, counts] of Object.entries(aggregations.countsByMinute)) {
    const id = `live#${minute}`;
    items.push(createItem(id, {
      total: counts.total,
      ...Object.fromEntries(
        Object.entries(counts).filter(([k]) => k !== 'total')
      )
    }));
  }

  // Other dimensions
  const dimensionMaps = [
    [aggregations.catAgg, 'cat#'],
    [aggregations.campaignAgg, 'campaign#'],
    [aggregations.deviceAgg, 'device#'],
    [aggregations.geoAgg, 'geo#'],
    [aggregations.ageAgg, 'age#'],
    [aggregations.segmentAgg, 'segment#']
  ];

  for (const [dimAgg, prefix] of dimensionMaps) {
    for (const [key, counts] of Object.entries(dimAgg)) {
      items.push(createItem(key, counts));
    }
  }

  // Revenue summary
  items.push(createItem('revenue#overall', aggregations.revenueAgg));

  // Anomaly summary
  items.push(createItem('anomaly#summary', aggregations.anomalyAgg));

  return items;
}

/**
 * Cursor pagination helper for DynamoDB
 * Encodes/decodes cursor as base64 to make it transport-friendly
 */
class CursorPagination {
  static encode(key) {
    return Buffer.from(JSON.stringify(key)).toString('base64');
  }

  static decode(cursor) {
    if (!cursor) return null;
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString());
    } catch (err) {
      console.error('Invalid cursor:', err.message);
      return null;
    }
  }

  static createResponse(items, lastEvaluatedKey, limit) {
    return {
      items,
      hasMore: !!lastEvaluatedKey,
      cursor: lastEvaluatedKey ? this.encode(lastEvaluatedKey) : null,
      count: items.length,
      limit
    };
  }
}

/**
 * Response caching layer for metrics
 * Reduces redundant database queries during stable periods
 */
class MetricsCache {
  constructor(ttlMs = 2000) {
    this.data = null;
    this.timestamp = 0;
    this.ttl = ttlMs;
  }

  set(data) {
    this.data = data;
    this.timestamp = Date.now();
  }

  get() {
    const isExpired = Date.now() - this.timestamp > this.ttl;
    if (isExpired) {
      this.data = null;
      return null;
    }
    return this.data;
  }

  isValid() {
    return this.data !== null && !this.isExpired();
  }

  isExpired() {
    return Date.now() - this.timestamp > this.ttl;
  }

  clear() {
    this.data = null;
    this.timestamp = 0;
  }
}

module.exports = {
  calculateAggregationsOptimized,
  batchWriteItems,
  prepareItemsForBatchWrite,
  CursorPagination,
  MetricsCache
};
