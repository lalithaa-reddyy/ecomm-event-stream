const crypto = require("crypto");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

// AWS clients (reuse between invocations)
const s3 = new S3Client({});
const ddbClient = new DynamoDBClient({});
const ddbDoc = DynamoDBDocumentClient.from(ddbClient);
const sns = new SNSClient({});

const PRODUCT_CATEGORIES = ["electronics", "fashion", "home_appliances", "beauty", "sports", "books", "groceries", "toys"];

function logEvent(type, payload = {}) {
    const event = {
        eventId: crypto.randomUUID(),
        eventType: type,
        timestamp: new Date().toISOString(),
        payload
    };

    console.log(JSON.stringify({ level: "INFO", message: "Event ingested", event }));

    return event;
}

async function writeRawToS3Object(key, body, bucket) {
    const bucketName = bucket || process.env.RAW_BUCKET;
    if (!bucketName) throw new Error('Bucket name not provided');
    await s3.send(new PutObjectCommand({ Bucket: bucketName, Key: key, Body: JSON.stringify(body), ContentType: 'application/json' }));
}

async function updateAggregationCounts(countsByMinute) {
    const table = process.env.AGG_TABLE;
    if (!table) throw new Error('AGG_TABLE env var not set');

    for (const [minute, counts] of Object.entries(countsByMinute)) {
        const aggId = `live#${minute}`;

        const addParts = [];
        const exprNames = { '#lastSeen': 'lastSeen' };
        const exprValues = { ':ts': minute + ':00Z' };

        addParts.push('#total :total');
        exprNames['#total'] = 'total';
        exprValues[':total'] = counts.total;

        let vIdx = 0;
        for (const [etype, cnt] of Object.entries(counts)) {
            if (etype === 'total') continue;
            vIdx += 1;
            const nameKey = `#t${vIdx}`;
            const valKey = `:v${vIdx}`;
            exprNames[nameKey] = etype;
            exprValues[valKey] = cnt;
            addParts.push(`${nameKey} ${valKey}`);
        }

        const UpdateExpression = `ADD ${addParts.join(', ')} SET #lastSeen = :ts`;

        const params = {
            TableName: table,
            Key: { id: aggId },
            UpdateExpression,
            ExpressionAttributeNames: exprNames,
            ExpressionAttributeValues: exprValues
        };

        await ddbDoc.send(new UpdateCommand(params));
    }
}

async function updateDimensionAggregations(allAgg) {
    const table = process.env.AGG_TABLE;
    if (!table) return;

    const writes = Object.entries(allAgg).map(([id, counts]) => {
        const numeric = Object.entries(counts).filter(([, v]) => typeof v === 'number' && v > 0);
        if (numeric.length === 0) return null;

        const addParts = [];
        const exprNames = {};
        const exprValues = {};

        numeric.forEach(([field, val], idx) => {
            const nameKey = `#f${idx}`;
            const valKey  = `:v${idx}`;
            exprNames[nameKey] = field;
            exprValues[valKey] = val;
            addParts.push(`${nameKey} ${valKey}`);
        });

        return ddbDoc.send(new UpdateCommand({
            TableName: table,
            Key: { id },
            UpdateExpression: `ADD ${addParts.join(', ')}`,
            ExpressionAttributeNames: exprNames,
            ExpressionAttributeValues: exprValues
        }));
    }).filter(Boolean);

    await Promise.all(writes);
}

async function processIncoming(type, event) {
    let payload = {};
    try {
        if (event && typeof event.body === 'string') payload = JSON.parse(event.body);
        else if (event && event.body) payload = event.body;
    } catch (err) {
        console.warn('Failed to parse incoming body, using empty object');
    }

    const evt = logEvent(type, payload);

    // Write anomaly event to secondary bucket for analysis
    try {
        const anomalyBucket = process.env.ANOMALY_BUCKET;
        if (anomalyBucket) {
            const key = `anomalies/${evt.timestamp.slice(0, 10)}/${evt.timestamp}-${evt.eventId}.json`;
            await writeRawToS3Object(key, evt, anomalyBucket);
            console.info(`Stored anomaly event in bucket: ${key}`);
        } else {
            console.warn('ANOMALY_BUCKET not set, skipping anomaly storage');
        }
    } catch (err) {
        console.error('Failed to write anomaly to S3', err);
    }

    // Send SNS notification for anomaly
    try {
        const topicArn = process.env.SNS_TOPIC_ARN;
        if (topicArn) {
            const message = {
                anomalyId: evt.eventId,
                type: evt.eventType,
                timestamp: evt.timestamp,
                payload: evt.payload
            };
            await sns.send(new PublishCommand({
                TopicArn: topicArn,
                Subject: `Anomaly Detected: ${evt.eventType}`,
                Message: JSON.stringify(message, null, 2)
            }));
            console.info(`Sent SNS notification for anomaly: ${evt.eventId}`);
        } else {
            console.warn('SNS_TOPIC_ARN not set, skipping SNS notification');
        }
    } catch (err) {
        console.error('Failed to send SNS notification', err);
    }

    return evt;
}

async function generateAndIngestBatch(rate) {
    const batchId = crypto.randomUUID();
    const eventTypes    = ['page_view', 'product_view', 'add_to_cart', 'order'];
    const CAMPAIGNS     = ['cmp_mobile_summer', 'cmp_festive_sale', 'cmp_flash_deal', 'cmp_new_launch', 'cmp_member_special'];
    const DEVICE_TYPES  = ['mobile', 'desktop', 'tablet'];
    const CITIES        = ['Bengaluru', 'Mumbai', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur'];
    const USER_SEGMENTS = ['student', 'working_professional', 'high_income', 'frequent_shopper'];
    const AGE_GROUPS    = ['13-18', '19-25', '26-35', '36-45', '46-55', '55+'];
    const ANOMALY_TYPES = ['bot_activity', 'fraud_order', 'price_spike'];
    
    // Category profiles: traffic weight, min price, max price, conversion bias (affects add_to_cart → order rate)
    const CATEGORY_PROFILES = {
        'electronics':      { weight: 15, minPrice: 5000, maxPrice: 15000, conversionBias: 0.06, volatility: 1.8 },
        'fashion':          { weight: 20, minPrice: 500,  maxPrice: 3000,  conversionBias: 0.08, volatility: 2.2 },
        'home_appliances':  { weight: 10, minPrice: 3000, maxPrice: 12000, conversionBias: 0.03, volatility: 0.8 },
        'beauty':           { weight: 12, minPrice: 300,  maxPrice: 1500,  conversionBias: 0.07, volatility: 2.0 },
        'sports':           { weight: 8,  minPrice: 1000, maxPrice: 5000,  conversionBias: 0.04, volatility: 1.5 },
        'books':            { weight: 15, minPrice: 200,  maxPrice: 800,   conversionBias: 0.10, volatility: 1.3 },
        'groceries':        { weight: 28, minPrice: 100,  maxPrice: 500,   conversionBias: 0.05, volatility: 0.9 },
        'toys':             { weight: 12, minPrice: 500,  maxPrice: 2500,  conversionBias: 0.04, volatility: 1.6 }
    };

    const r = arr => arr[Math.floor(Math.random() * arr.length)];

    // Weighted city distribution (metro cities get more traffic)
    const CITY_WEIGHTS = {
        'Bengaluru': 22,
        'Mumbai': 20,
        'Pune': 18,
        'Hyderabad': 16,
        'Chennai': 12,
        'Kolkata': 8,
        'Ahmedabad': 2,
        'Jaipur': 2
    };

    const getWeightedCity = () => {
        const totalWeight = Object.values(CITY_WEIGHTS).reduce((s, w) => s + w, 0);
        let rand = Math.random() * totalWeight;
        for (const city of CITIES) {
            rand -= CITY_WEIGHTS[city] || 1;
            if (rand <= 0) return city;
        }
        return CITIES[0];
    };

    // Weighted user segment distribution
    const SEGMENT_WEIGHTS = {
        'student': 8,
        'working_professional': 45,
        'high_income': 35,
        'frequent_shopper': 12
    };

    const getWeightedSegment = () => {
        const totalWeight = Object.values(SEGMENT_WEIGHTS).reduce((s, w) => s + w, 0);
        let rand = Math.random() * totalWeight;
        for (const segment of USER_SEGMENTS) {
            rand -= SEGMENT_WEIGHTS[segment] || 1;
            if (rand <= 0) return segment;
        }
        return USER_SEGMENTS[0];
    };

    // Weighted campaign distribution
    const CAMPAIGN_WEIGHTS = {
        'cmp_flash_deal': 25,
        'cmp_festive_sale': 20,
        'cmp_member_special': 20,
        'cmp_mobile_summer': 20,
        'cmp_new_launch': 15
    };

    const getWeightedCampaign = () => {
        const totalWeight = Object.values(CAMPAIGN_WEIGHTS).reduce((s, w) => s + w, 0);
        let rand = Math.random() * totalWeight;
        for (const campaign of CAMPAIGNS) {
            rand -= CAMPAIGN_WEIGHTS[campaign] || 1;
            if (rand <= 0) return campaign;
        }
        return CAMPAIGNS[0];
    };

    // Add temporal variance: make batch size vary between 70% and 130% of requested rate
    const temporalVariance = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
    const actualBatchSize = Math.floor(rate * temporalVariance);

    // Weighted category selection based on traffic weights + temporal variance
    const getWeightedCategory = () => {
        const categories = Object.keys(CATEGORY_PROFILES);
        const now = Date.now();
        const minuteBucketSeed = Math.floor(now / 60000); // Changes every minute for different distributions
        
        // Hash-like function to create category-specific variations per minute
        const getCategoryVariance = (category, seed) => {
            const hash = (seed * 73856093 ^ category.charCodeAt(0) * 19349663) | 0;
            return 0.7 + ((Math.abs(hash) % 100) / 100) * 0.6; // 0.7 to 1.3 variance per category per minute
        };

        const totalWeight = Object.values(CATEGORY_PROFILES).reduce((sum, p, idx) => {
            const categoryVariance = getCategoryVariance(Object.keys(CATEGORY_PROFILES)[idx], minuteBucketSeed);
            return sum + (p.weight * categoryVariance);
        }, 0);
        
        let rand = Math.random() * totalWeight;
        for (const cat of categories) {
            const catVariance = getCategoryVariance(cat, minuteBucketSeed);
            rand -= CATEGORY_PROFILES[cat].weight * catVariance;
            if (rand <= 0) return cat;
        }
        return categories[0];
    };

    // Weighted event type selection
    const getWeightedEventType = () => {
        const rand = Math.random();
        if (rand < 0.40) return 'page_view';      // 40% - MOST
        if (rand < 0.75) return 'product_view';   // 35% - HIGH
        if (rand < 0.95) return 'add_to_cart';    // 20% - LOW
        return 'order';                            // 5% - VERY LOW
    };

    // Category-aware order value generation with per-category volatility
    const getOrderValue = (category) => {
        const profile = CATEGORY_PROFILES[category];
        if (!profile) return Math.floor(Math.random() * 4500) + 300;
        const minPrice = profile.minPrice;
        const maxPrice = profile.maxPrice;
        const range = maxPrice - minPrice;
        // Add volatility: some categories have wider price swings
        const volatilityFactor = 1 + (Math.random() - 0.5) * (profile.volatility - 1);
        const adjustedMax = Math.floor(maxPrice * volatilityFactor);
        return Math.floor(Math.random() * (adjustedMax - minPrice)) + minPrice;
    };

    const events = Array.from({ length: actualBatchSize }).map(() => {
        const category   = getWeightedCategory();
        const type       = getWeightedEventType();
        const isAnomaly  = false; // Anomalies will be injected manually, not generated randomly
        
        // Apply category-specific conversion bias: higher bias = more likely to convert to order
        let eventType = type;
        if (type === 'add_to_cart' && Math.random() < CATEGORY_PROFILES[category].conversionBias) {
            eventType = 'order';
        }
        
        const orderValue = eventType === 'order' ? getOrderValue(category) : 0;
        
        return {
            eventId: crypto.randomUUID(),
            eventType,
            product_category: category,
            campaignId:  getWeightedCampaign(),
            deviceType:  r(DEVICE_TYPES),
            city:        getWeightedCity(),
            segment:     getWeightedSegment(),
            ageGroup:    r(AGE_GROUPS),
            isAnomaly,
            anomalyType: isAnomaly ? r(ANOMALY_TYPES) : null,
            orderValue,
            timestamp: new Date().toISOString()
        };
    });

    // 1. Per-minute aggregations (timeline)
    const countsByMinute = {};
    for (const e of events) {
        const minute = e.timestamp.slice(0, 16);
        countsByMinute[minute] = countsByMinute[minute] || { total: 0 };
        countsByMinute[minute].total += 1;
        countsByMinute[minute][e.eventType] = (countsByMinute[minute][e.eventType] || 0) + 1;
    }

    // 2. Per-category aggregations
    const catAgg = {};
    for (const e of events) {
        const key = `cat#${e.product_category}`;
        if (!catAgg[key]) catAgg[key] = { total: 0 };
        catAgg[key].total += 1;
        catAgg[key][e.eventType] = (catAgg[key][e.eventType] || 0) + 1;
        if (e.orderValue > 0 && !e.isAnomaly) catAgg[key].revenue = (catAgg[key].revenue || 0) + e.orderValue;
    }

    // 3. Per-campaign aggregations
    const campaignAgg = {};
    for (const e of events) {
        const key = `campaign#${e.campaignId}`;
        if (!campaignAgg[key]) campaignAgg[key] = { total: 0 };
        campaignAgg[key].total += 1;
        if (e.eventType === 'order' && !e.isAnomaly) {
            campaignAgg[key].order_count = (campaignAgg[key].order_count || 0) + 1;
            campaignAgg[key].revenue     = (campaignAgg[key].revenue     || 0) + e.orderValue;
        }
    }

    // 4. Per-device aggregations
    const deviceAgg = {};
    for (const e of events) {
        const key = `device#${e.deviceType}`;
        if (!deviceAgg[key]) deviceAgg[key] = { total: 0 };
        deviceAgg[key].total += 1;
        if (e.eventType === 'order') {
            deviceAgg[key].order_count = (deviceAgg[key].order_count || 0) + 1;
        }
    }

    // 5. Per-city aggregations
    const geoAgg = {};
    for (const e of events) {
        const key = `geo#${e.city}`;
        if (!geoAgg[key]) geoAgg[key] = { total: 0 };
        geoAgg[key].total += 1;
        if (e.eventType === 'order' && !e.isAnomaly) {
            geoAgg[key].order_count = (geoAgg[key].order_count || 0) + 1;
            geoAgg[key].revenue     = (geoAgg[key].revenue     || 0) + e.orderValue;
        }
    }

    // 6. Per-age-group aggregations
    const ageAgg = {};
    for (const e of events) {
        const key = `age#${e.ageGroup}`;
        if (!ageAgg[key]) ageAgg[key] = { total: 0 };
        ageAgg[key].total += 1;
        ageAgg[key][e.eventType] = (ageAgg[key][e.eventType] || 0) + 1;
        if (e.eventType === 'order' && !e.isAnomaly) {
            ageAgg[key].order_count = (ageAgg[key].order_count || 0) + 1;
            ageAgg[key].revenue     = (ageAgg[key].revenue     || 0) + e.orderValue;
        }
    }

    // 7. Revenue summary (exclude anomalies)
    const totalRevenue = events.filter(e => !e.isAnomaly).reduce((s, e) => s + e.orderValue, 0);
    const orderCount   = events.filter(e => e.eventType === 'order' && !e.isAnomaly).length;
    const revenueAgg   = { 'revenue#overall': { total_revenue: Math.round(totalRevenue), order_count: orderCount } };

    // 8. Anomaly summary
    const anomalyEvents = events.filter(e => e.isAnomaly);
    let anomalyAgg = {};
    if (anomalyEvents.length > 0) {
        const summary = { total_anomalies: anomalyEvents.length };
        for (const e of anomalyEvents) {
            if (e.anomalyType) summary[e.anomalyType] = (summary[e.anomalyType] || 0) + 1;
        }
        anomalyAgg = { 'anomaly#summary': summary };
    }

    // Write raw batch to S3
    if (process.env.RAW_BUCKET) {
        try {
            const key = `raw-events/start/batch-${batchId}.json`;
            await writeRawToS3Object(key, events);
            console.info(`Wrote generated batch to S3: batch-${batchId}.json`);
        } catch (err) {
            console.error('Failed to write batch to S3:', err.message);
        }
    } else {
        console.warn('RAW_BUCKET not set, skipping S3 write');
    }

    // Update all aggregations
    console.log('AGG_TABLE env var:', process.env.AGG_TABLE);
    console.log('countsByMinute keys:', Object.keys(countsByMinute));
    if (process.env.AGG_TABLE) {
        try {
            console.log('Calling updateAggregationCounts with', Object.keys(countsByMinute).length, 'minutes');
            await updateAggregationCounts(countsByMinute);
            console.log('Calling updateDimensionAggregations');
            await updateDimensionAggregations({
                ...catAgg, ...campaignAgg, ...deviceAgg, ...geoAgg, ...ageAgg, ...revenueAgg, ...anomalyAgg
            });
            console.info('Updated all aggregations in DynamoDB');
        } catch (err) {
            console.error('Failed to update aggregations:', err.message, err.stack);
        }
    } else {
        console.warn('AGG_TABLE not set, skipping DynamoDB update');
    }

    return { batchId, rate, minutes: Object.keys(countsByMinute).length };
}

async function getMetrics() {
    const table = process.env.AGG_TABLE;
    if (!table) throw new Error('AGG_TABLE env var not set');

    try {
        // Paginated scan — gets all records regardless of count
        let items = [];
        let lastKey;
        do {
            const result = await ddbDoc.send(new ScanCommand({
                TableName: table,
                ExclusiveStartKey: lastKey
            }));
            items = items.concat(result.Items || []);
            lastKey = result.LastEvaluatedKey;
        } while (lastKey);

        // Partition by id prefix
        const liveItems     = items.filter(i => i.id?.startsWith('live#'))
                                   .sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || ''));
        const catItems      = items.filter(i => i.id?.startsWith('cat#'));
        const campaignItems = items.filter(i => i.id?.startsWith('campaign#'));
        const deviceItems   = items.filter(i => i.id?.startsWith('device#'));
        const geoItems      = items.filter(i => i.id?.startsWith('geo#'));
        const ageItems      = items.filter(i => i.id?.startsWith('age#'));
        const revenueItem   = items.find(i => i.id === 'revenue#overall') || {};
        const anomalyItem   = items.find(i => i.id === 'anomaly#summary') || {};

        // Total events + funnel breakdown from live records
        const totalEvents  = liveItems.reduce((s, i) => s + (i.total || 0), 0);
        const eventsByType = {};
        liveItems.forEach(item => {
            Object.entries(item).forEach(([key, value]) => {
                if (key !== 'id' && key !== 'lastSeen' && key !== 'total' && typeof value === 'number') {
                    eventsByType[key] = (eventsByType[key] || 0) + value;
                }
            });
        });

        // Category stats
        const categoryStats = {};
        catItems.forEach(({ id, ...rest }) => { categoryStats[id.replace('cat#', '')] = rest; });

        // Campaign stats
        const campaignStats = {};
        campaignItems.forEach(({ id, ...rest }) => { campaignStats[id.replace('campaign#', '')] = rest; });

        // Device stats
        const deviceStats = {};
        deviceItems.forEach(({ id, ...rest }) => { deviceStats[id.replace('device#', '')] = rest; });

        // Geo stats
        const geoStats = {};
        geoItems.forEach(({ id, ...rest }) => { geoStats[id.replace('geo#', '')] = rest; });

        // Age stats
        const ageStats = {};
        ageItems.forEach(({ id, ...rest }) => { ageStats[id.replace('age#', '')] = rest; });

        // Revenue stats
        const { id: _rId, ...revenueStats } = revenueItem;
        const rOrd = revenueStats.order_count || 0;
        const rRev = revenueStats.total_revenue || 0;
        revenueStats.avg_order_value = rOrd > 0 ? Math.round(rRev / rOrd) : 0;

        // Anomaly stats
        const { id: _aId, ...anomalyStats } = anomalyItem;

        return {
            totalEvents,
            eventsByType,
            recentMinutes: liveItems.slice(0, 20),
            dataPoints: liveItems.length,
            categoryStats,
            campaignStats,
            deviceStats,
            geoStats,
            ageStats,
            revenueStats,
            anomalyStats
        };
    } catch (err) {
        console.error('Failed to get metrics:', err);
        return {
            totalEvents: 0,
            eventsByType: {},
            recentMinutes: [],
            dataPoints: 0,
            categoryStats: {},
            campaignStats: {},
            deviceStats: {},
            geoStats: {},
            ageStats: {},
            revenueStats: {},
            anomalyStats: {}
        };
    }
}

exports.handler = async (event) => {
    console.log('Event received:', JSON.stringify(event, null, 2));
    
    // Handle GET /stream (metrics endpoint)
    if (event.httpMethod === 'GET' || event.requestContext?.http?.method === 'GET') {
        try {
            const metrics = await getMetrics();
            return { 
                statusCode: 200, 
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: JSON.stringify(metrics) 
            };
        } catch (err) {
            console.error('Metrics error:', err.message);
            return { 
                statusCode: 500, 
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: JSON.stringify({ error: err.message || 'failed to fetch metrics' })
            };
        }
    }

    let body = {};
    try {
        if (event && event.body) {
            body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        }
    } catch (err) {
        console.error('Error parsing body:', err.message);
        return { 
            statusCode: 400, 
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({ error: 'Invalid JSON body' }) 
        };
    }

    const action = body.action || 'unknown';
    console.log('Action:', action);

    try {
        if (action === 'start') {
            const rate = Number(body.rate) || 10000;
            const result = await generateAndIngestBatch(rate);
            return { 
                statusCode: 200, 
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: JSON.stringify(result) 
            };
        }

        if (action === 'anomaly') {
            const evt = await processIncoming('ANOMALY', event);
            return { 
                statusCode: 200, 
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: JSON.stringify(evt) 
            };
        }

        return { 
            statusCode: 400, 
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({ error: `unknown action: ${action}`, received: body }) 
        };
    } catch (err) {
        console.error('Handler error:', err.message, err.stack);
        return { 
            statusCode: 500, 
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({ error: err.message || 'internal error' }) 
        };
    }
};