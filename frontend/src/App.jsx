import { useState, useEffect, useRef } from "react";
import "./index.css";

const API_ENDPOINT = import.meta.env.VITE_API_BASE_URL;
const EVENT_RATE_PER_MINUTE = 10000;
const EVENT_RATE_PER_SECOND = Math.ceil(EVENT_RATE_PER_MINUTE / 60);
const GENDERS = ["male", "female"];
const SCHEMA_VERSION = "1.0";
const EVENT_TYPES = ["page_view", "product_view", "add_to_cart", "order"];
const BOT_EVENT_TYPES = ["page_view", "product_view"];
const BOT_THRESHOLD = 100;
const USER_SEGMENTS = ["student", "working_professional", "high_income", "frequent_shopper"];
const CAMPAIGNS = [
  "cmp_mobile_summer",
  "cmp_festive_sale",
  "cmp_flash_deal",
  "cmp_new_launch",
  "cmp_member_special"
];
const AGE_GROUPS = ["18-24", "25-34", "35-44", "45-54"];
const USER_SEGMENT_BY_AGE = {
  "18-24": ["student", "frequent_shopper"],
  "25-34": ["working_professional", "frequent_shopper", "high_income"],
  "35-44": ["working_professional", "frequent_shopper", "high_income"],
  "45-54": ["high_income", "frequent_shopper"]
};
const DEVICE_TYPES = ["mobile", "desktop", "tablet"];
const randomChoice = (items) => items[Math.floor(Math.random() * items.length)];
const randomAgeGroup = () => randomChoice(AGE_GROUPS);
const randomUserSegment = (ageGroup) => randomChoice(USER_SEGMENT_BY_AGE[ageGroup] || USER_SEGMENTS);
const randomDeviceType = () => randomChoice(DEVICE_TYPES);
const PRODUCT_CATEGORIES = [
  "electronics", "fashion", "home_appliances", "beauty",
  "sports", "books", "groceries", "toys"
];
const randomCategory = (eventType) =>
  eventType === "page_view" && Math.random() < 0.3
    ? randomChoice(["homepage", "search_results"])
    : randomChoice(PRODUCT_CATEGORIES);
const EVENT_FIELDS = [
  "event_id",
  "event_type",
  "product_category",
  "anomaly_type",
  "event_timestamp",
  "ingestion_time",
  "schema_version",
  "year",
  "month",
  "day",
  "hour",
  "campaign_id",
  "country",
  "region",
  "city",
  "user_id",
  "age_group",
  "gender",
  "user_segment",
  "device_id",
  "device_type",
  "os",
  "browser",
  "user_agent",
  "ip_address",
  "price",
  "last_price",
  "mean_price",
  "std_dev",
  "price_updates_last_min",
  "is_spike",
  "spike_reason",
  "order_value",
  "user_avg_order_value",
  "orders_last_minute",
  "geo_mismatch",
  "failed_attempts",
  "is_fraud",
  "fraud_reason",
  "is_anomaly"
];
const DEVICE_PROFILES = [
  {
    os: "Windows 11",
    browser: "Chrome",
    user_agent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  },
  {
    os: "macOS Ventura",
    browser: "Safari",
    user_agent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15"
  },
  {
    os: "Android 14",
    browser: "Chrome Mobile",
    user_agent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
  },
  {
    os: "iOS 17",
    browser: "Safari Mobile",
    user_agent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/605.1.15"
  }
];
const USER_ADDRESSES = [
  {
    city: "Bengaluru",
    state: "Karnataka",
    country: "India"
  },
  {
    city: "Chennai",
    state: "Tamil Nadu",
    country: "India"
  },
  {
    city: "Hyderabad",
    state: "Telangana",
    country: "India"
  },
  {
    city: "Kolkata",
    state: "West Bengal",
    country: "India"
  },
  {
    city: "Mumbai",
    state: "Maharashtra",
    country: "India"
  },
  {
    city: "Pune",
    state: "Maharashtra",
    country: "India"
  },
  {
    city: "Ahmedabad",
    state: "Gujarat",
    country: "India"
  },
  {
    city: "Jaipur",
    state: "Rajasthan",
    country: "India"
  },
  {
    city: "Lucknow",
    state: "Uttar Pradesh",
    country: "India"
  },
  {
    city: "Kochi",
    state: "Kerala",
    country: "India"
  }
];
const GEOLOCATIONS = [
  {
    prefix: "14.139",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India"
  },
  {
    prefix: "19.076",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India"
  },
  {
    prefix: "23.022",
    city: "Ahmedabad",
    state: "Gujarat",
    country: "India"
  },
  {
    prefix: "18.520",
    city: "Pune",
    state: "Maharashtra",
    country: "India"
  },
  {
    prefix: "28.613",
    city: "New Delhi",
    state: "Delhi",
    country: "India"
  },
  {
    prefix: "12.971",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India"
  }
];

export default function App() {
  const [status, setStatus] = useState("stopped");
  const [events, setEvents] = useState([]);
  const [anomalyEvents, setAnomalyEvents] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState(null);
  const streamIntervalRef = useRef(null);

  const showToast = (message, isError = false) => {
    setToast({ message, isError });

    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const renderValue = (value) =>
    value === null || value === undefined ? "-" : typeof value === "boolean" ? (value ? "true" : "false") : value;

  const randomNormalPrice = () => Number((Math.random() * 150 + 20).toFixed(2));
  const randomPriceSpike = (base) => Number((base * (3 + Math.random() * 2)).toFixed(2));
  const makeEventId = () => `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  const createAnomalyEvent = (type, options = {}) => {
    const userAddress = options.userAddress || USER_ADDRESSES[Math.floor(Math.random() * USER_ADDRESSES.length)];
    const geo = options.geo || GEOLOCATIONS[Math.floor(Math.random() * GEOLOCATIONS.length)];
    const device = options.device || DEVICE_PROFILES[Math.floor(Math.random() * DEVICE_PROFILES.length)];
    const ageGroup = options.ageGroup || randomAgeGroup();
    const eventType = options.eventType || randomChoice(EVENT_TYPES);
    const userSegment = options.userSegment || randomUserSegment(ageGroup);
    const deviceType = options.deviceType || randomDeviceType();
    const ipAddress = options.ipAddress || `${geo.prefix}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
    const timestamp = options.timestamp || new Date();
    const eventTimestamp = timestamp.toISOString();
    const ingestionTime = new Date(timestamp.getTime() + 1000).toISOString();
    const eventId = options.eventId || makeEventId();
    const userId = options.userId || `user_${Math.floor(Math.random() * 9000) + 1000}`;
    const campaignId = options.campaignId || randomChoice(CAMPAIGNS);
    const gender = options.gender || randomChoice(GENDERS);
    const deviceId = options.deviceId || `dev_${Math.floor(Math.random() * 900000) + 100000}`;
    const os = device.os.toLowerCase().includes("android")
      ? "android"
      : device.os.toLowerCase().includes("ios")
      ? "ios"
      : device.os.toLowerCase().includes("windows")
      ? "windows"
      : "macos";
    const browser = device.browser.toLowerCase().includes("chrome")
      ? "chrome"
      : device.browser.toLowerCase().includes("safari")
      ? "safari"
      : device.browser.toLowerCase();
    const price = options.price ?? randomNormalPrice();
    const orderValue = options.order_value ?? (eventType === "order" ? price : null);
    const userAvg = options.user_avg_order_value ?? Number((price / 2).toFixed(2));
    const ordersLastMinute = options.orders_last_minute ?? 0;
    const geoMismatch = options.geo_mismatch ?? false;
    const failedAttempts = options.failed_attempts ?? 0;
    const isFraud = options.is_fraud ?? false;
    const fraudReason = options.fraud_reason || null;
    const lastPrice = options.last_price ?? null;
    const meanPrice = options.mean_price ?? null;
    const stdDev = options.std_dev ?? null;
    const priceUpdatesLastMin = options.price_updates_last_min ?? 0;
    const isSpike = options.is_spike ?? false;
    const spikeReason = options.spike_reason || null;
    const productCategory = options.product_category || randomCategory(eventType);

    return {
      event_id: eventId,
      event_type: eventType,
      product_category: productCategory,
      event_timestamp: eventTimestamp,
      ingestion_time: ingestionTime,
      schema_version: SCHEMA_VERSION,
      year: timestamp.getUTCFullYear(),
      month: timestamp.getUTCMonth() + 1,
      day: timestamp.getUTCDate(),
      hour: timestamp.getUTCHours(),
      campaign_id: campaignId,
      country: "India",
      region: userAddress.state,
      city: userAddress.city,
      user_id: userId,
      age_group: ageGroup,
      gender,
      user_segment: userSegment,
      device_id: deviceId,
      device_type: deviceType,
      os,
      browser,
      user_agent: device.user_agent,
      ip_address: ipAddress,
      price,
      last_price: lastPrice,
      mean_price: meanPrice,
      std_dev: stdDev,
      price_updates_last_min: priceUpdatesLastMin,
      is_spike: isSpike,
      spike_reason: spikeReason,
      order_value: orderValue,
      user_avg_order_value: userAvg,
      orders_last_minute: ordersLastMinute,
      geo_mismatch: geoMismatch,
      failed_attempts: failedAttempts,
      is_fraud: isFraud,
      fraud_reason: fraudReason,
      is_anomaly: true,
      anomaly_type: type
    };
  };

  const createBotBurst = (type) => {
    const userAddress = USER_ADDRESSES[Math.floor(Math.random() * USER_ADDRESSES.length)];
    const geo = GEOLOCATIONS[Math.floor(Math.random() * GEOLOCATIONS.length)];
    const device = DEVICE_PROFILES[Math.floor(Math.random() * DEVICE_PROFILES.length)];
    const userId = `user_${Math.floor(Math.random() * 9000) + 1000}`;
    const deviceId = `dev_${Math.floor(Math.random() * 900000) + 100000}`;
    const ipAddress = `${geo.prefix}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
    const campaignId = randomChoice(CAMPAIGNS);
    const basePrice = randomNormalPrice();
    const productCategory = randomCategory("product_view");
    const eventCount = 100;
    const baseTime = Date.now();

    return Array.from({ length: eventCount }).map((_, index) => {
      const timestamp = new Date(baseTime + index * 150);
      const ageGroup = randomAgeGroup();
      const eventType =
        index < 50
          ? BOT_EVENT_TYPES[index % BOT_EVENT_TYPES.length]
          : index < 80
          ? "product_view"
          : index < 95
          ? "add_to_cart"
          : "order";

      return createAnomalyEvent(type, {
        userAddress,
        geo,
        device,
        eventType,
        userSegment: randomUserSegment(ageGroup),
        deviceType: randomDeviceType(),
        ipAddress,
        timestamp,
        userId,
        deviceId,
        campaignId,
        ageGroup,
        gender: randomChoice(GENDERS),
        price: basePrice,
        product_category: productCategory
      });
    });
  };

  const callAPI = async (endpoint, body = {}) => {
    try {
      const res = await fetch(`${API_ENDPOINT}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      return await res.json();
    } catch (err) {
      console.error("API error:", err);
    }
  };

  const startStream = () => {
    setStatus("running");
    showToast("Stream started - generating events every 5 seconds", false);
  };

  const stopStream = () => {
    setStatus("stopped");
    showToast("Stream stopped", false);
  };

  const createPriceSpikeBurst = (type) => {
    const userAddress = USER_ADDRESSES[Math.floor(Math.random() * USER_ADDRESSES.length)];
    const geo = GEOLOCATIONS[Math.floor(Math.random() * GEOLOCATIONS.length)];
    const device = DEVICE_PROFILES[Math.floor(Math.random() * DEVICE_PROFILES.length)];
    const userId = `user_${Math.floor(Math.random() * 9000) + 1000}`;
    const deviceId = `dev_${Math.floor(Math.random() * 900000) + 100000}`;
    const ipAddress = `${geo.prefix}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
    const basePrice = randomNormalPrice();
    const spikePrice = randomPriceSpike(basePrice);
    const eventCount = 7;
    const baseTime = Date.now();
    const historicalPrices = Array.from({ length: 5 }, () => Number((basePrice * (0.9 + Math.random() * 0.2)).toFixed(2)));
    const meanPrice = Number((historicalPrices.reduce((sum, p) => sum + p, 0) / historicalPrices.length).toFixed(2));
    const stdDev = Number(
      Math.sqrt(
        historicalPrices.reduce((sum, p) => sum + Math.pow(p - meanPrice, 2), 0) / historicalPrices.length
      ).toFixed(2)
    );
    let lastPrice = historicalPrices[historicalPrices.length - 1];
    const priceUpdatesLastMin = 6;
    const productCategory = randomCategory("product_view");

    return Array.from({ length: eventCount }).map((_, index) => {
      const timestamp = new Date(baseTime + index * 250);
      const isSpikePhase = index >= 2;
      const price = isSpikePhase
        ? Number((basePrice + (spikePrice - basePrice) * (0.5 + index / eventCount)).toFixed(2))
        : Number((basePrice * (0.9 + Math.random() * 0.2)).toFixed(2));
      const ageGroup = randomAgeGroup();
      const isSpike =
        price > 1.5 * lastPrice || price > meanPrice + 3 * stdDev || priceUpdatesLastMin > 5;
      const spikeReasons = [];

      if (price > 1.5 * lastPrice) spikeReasons.push("large_delta");
      if (price > meanPrice + 3 * stdDev) spikeReasons.push("statistical_outlier");
      if (priceUpdatesLastMin > 5) spikeReasons.push("high_update_rate");

      const spikeReason = spikeReasons.length ? spikeReasons.join(", ") : null;
      const eventType = index === 0 ? "product_view" : index < 3 ? "add_to_cart" : "order";
      const event = createAnomalyEvent(type, {
        userAddress,
        geo,
        device,
        eventType,
        userSegment: randomUserSegment(ageGroup),
        deviceType: randomDeviceType(),
        ipAddress,
        timestamp,
        userId,
        deviceId,
        campaignId: randomChoice(CAMPAIGNS),
        ageGroup,
        gender: randomChoice(GENDERS),
        price,
        last_price: lastPrice,
        mean_price: meanPrice,
        std_dev: stdDev,
        price_updates_last_min: priceUpdatesLastMin,
        is_spike: isSpike,
        spike_reason: spikeReason,
        product_category: productCategory
      });
      lastPrice = price;
      return event;
    });
  };

  const createFraudOrderBurst = () => {
    const userAddress = USER_ADDRESSES[Math.floor(Math.random() * USER_ADDRESSES.length)];
    const geo = GEOLOCATIONS[Math.floor(Math.random() * GEOLOCATIONS.length)];
    const device = DEVICE_PROFILES[Math.floor(Math.random() * DEVICE_PROFILES.length)];
    const userId = `user_${Math.floor(Math.random() * 9000) + 1000}`;
    const deviceId = `dev_${Math.floor(Math.random() * 900000) + 100000}`;
    const ipAddress = `${geo.prefix}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
    const campaignId = randomChoice(CAMPAIGNS);
    const userAvg = Number((Math.random() * 180 + 50).toFixed(2));
    const ordersLastMinute = 4 + Math.floor(Math.random() * 3);
    const failedAttempts = 2 + Math.floor(Math.random() * 2);
    const eventCount = 20;
    const baseTime = Date.now();
    const productCategory = randomCategory("product_view");

    return Array.from({ length: eventCount }).map((_, index) => {
      const timestamp = new Date(baseTime + index * 220);
      const eventType = index % 4 === 3 ? "order" : index % 2 === 0 ? "product_view" : "add_to_cart";
      const orderValue = eventType === "order" ? Number((randomNormalPrice() * (2 + Math.random() * 4)).toFixed(2)) : null;
      const geoMismatch = eventType === "order" && orderValue > 1000 && Math.random() < 0.7;
      let isFraud = false;
      const fraudReasons = [];

      if (eventType === "order" && orderValue > 3 * userAvg) {
        isFraud = true;
        fraudReasons.push("high_value_order");
      }
      if (ordersLastMinute > 3) {
        isFraud = true;
        fraudReasons.push("high_order_rate");
      }
      if (geoMismatch && orderValue > 1000) {
        isFraud = true;
        fraudReasons.push("geo_mismatch_high_value");
      }
      if (failedAttempts >= 2 && eventType === "order") {
        isFraud = true;
        fraudReasons.push("failed_attempts_on_order");
      }

      return createAnomalyEvent("fraud_order", {
        userAddress,
        geo,
        device,
        eventType,
        userSegment: randomUserSegment(randomAgeGroup()),
        deviceType: randomDeviceType(),
        ipAddress,
        timestamp,
        userId,
        deviceId,
        campaignId,
        ageGroup: randomAgeGroup(),
        gender: randomChoice(GENDERS),
        price: orderValue || randomNormalPrice(),
        order_value: orderValue,
        user_avg_order_value: userAvg,
        orders_last_minute: ordersLastMinute,
        geo_mismatch: geoMismatch,
        failed_attempts: failedAttempts,
        is_fraud: isFraud,
        fraud_reason: fraudReasons.length ? fraudReasons.join(", ") : null,
        product_category: productCategory
      });
    });
  };

  const sendAnomaly = async (type) => {
    try {
      await callAPI("/stream", { action: "anomaly", type });

      if (type === "bot_activity") {
        const botEvents = createBotBurst(type);
        setAnomalyEvents(prev => [...botEvents, ...prev].slice(0, 20));
        setEvents(prev => [...botEvents, ...prev].slice(0, 100));
      } else if (type === "fraud_order") {
        const fraudEvents = createFraudOrderBurst();
        setAnomalyEvents(prev => [...fraudEvents, ...prev].slice(0, 20));
        setEvents(prev => [...fraudEvents, ...prev].slice(0, 100));
      } else if (type === "price_spike") {
        const priceEvents = createPriceSpikeBurst(type);
        setAnomalyEvents(prev => [...priceEvents, ...prev].slice(0, 20));
        setEvents(prev => [...priceEvents, ...prev].slice(0, 100));
      } else {
        const anomalyEvent = createAnomalyEvent(type);
        setAnomalyEvents(prev => [anomalyEvent, ...prev].slice(0, 20));
        setEvents(prev => [anomalyEvent, ...prev].slice(0, 100));
      }

      showToast(`${type} injected successfully`);
    } catch (err) {
      showToast("Error sending anomaly", true);
    }
  };

  // Streaming effect: continuously call API every 5 seconds when running
  useEffect(() => {
    if (status === "running") {
      // Add temporal variance to batch size (70% to 130% of expected rate)
      const getVariableBatchSize = () => {
        const variance = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
        return Math.floor(EVENT_RATE_PER_MINUTE * variance);
      };

      // Call API immediately on start with varying rate
      callAPI("/stream", { action: "start", rate: getVariableBatchSize() });

      // Then set up interval to call every 5 seconds with randomized rates
      streamIntervalRef.current = setInterval(async () => {
        try {
          await callAPI("/stream", { action: "start", rate: getVariableBatchSize() });
        } catch (err) {
          console.error("Error calling stream API:", err);
        }
      }, 5000);

      return () => {
        if (streamIntervalRef.current) {
          clearInterval(streamIntervalRef.current);
          streamIntervalRef.current = null;
        }
      };
    }
  }, [status]);

  // Category profiles for realistic data variance with volatility and temporal shifts
  const CATEGORY_CONFIG = {
    electronics:      { weight: 25, minPrice: 5000, maxPrice: 15000, conversionBias: 0.06, volatility: 1.8 },
    fashion:          { weight: 20, minPrice: 500,  maxPrice: 3000,  conversionBias: 0.08, volatility: 2.2 },
    home_appliances:  { weight: 10, minPrice: 3000, maxPrice: 12000, conversionBias: 0.03, volatility: 0.8 },
    beauty:           { weight: 12, minPrice: 300,  maxPrice: 1500,  conversionBias: 0.07, volatility: 2.0 },
    sports:           { weight: 8,  minPrice: 1000, maxPrice: 5000,  conversionBias: 0.04, volatility: 1.5 },
    books:            { weight: 15, minPrice: 200,  maxPrice: 800,   conversionBias: 0.10, volatility: 1.3 },
    groceries:        { weight: 18, minPrice: 100,  maxPrice: 500,   conversionBias: 0.05, volatility: 0.9 },
    toys:             { weight: 12, minPrice: 500,  maxPrice: 2500,  conversionBias: 0.04, volatility: 1.6 }
  };

  // Simple hash for deterministic randomness per minute per category
  const getCategoryVariance = (category, minuteSeed) => {
    const hash = (minuteSeed * 73856093 ^ category.charCodeAt(0) * 19349663) | 0;
    return 0.7 + ((Math.abs(hash) % 100) / 100) * 0.6; // 0.7 to 1.3 variance
  };

  const getWeightedCategory = () => {
    const categories = Object.keys(CATEGORY_CONFIG);
    const minuteBucketSeed = Math.floor(Date.now() / 60000); // Changes every minute
    
    const totalWeight = Object.values(CATEGORY_CONFIG).reduce((sum, p, idx) => {
      const categoryVariance = getCategoryVariance(categories[idx], minuteBucketSeed);
      return sum + (p.weight * categoryVariance);
    }, 0);
    
    let rand = Math.random() * totalWeight;
    for (const cat of categories) {
      const catVariance = getCategoryVariance(cat, Math.floor(Date.now() / 60000));
      rand -= CATEGORY_CONFIG[cat].weight * catVariance;
      if (rand <= 0) return cat;
    }
    return categories[0];
  };

  const getWeightedEventType = () => {
    const rand = Math.random();
    if (rand < 0.40) return 'page_view';
    if (rand < 0.75) return 'product_view';
    if (rand < 0.95) return 'add_to_cart';
    return 'order';
  };

  const getCategoryPrice = (category) => {
    const config = CATEGORY_CONFIG[category];
    if (!config) return Number((Math.random() * 150 + 20).toFixed(2));
    
    // Add volatility: some categories have wider price swings
    const volatilityFactor = 1 + (Math.random() - 0.5) * (config.volatility - 1);
    const adjustedMax = Math.floor(config.maxPrice * volatilityFactor);
    const minPrice = config.minPrice;
    return Math.floor(Math.random() * (adjustedMax - minPrice)) + minPrice;
  };

  useEffect(() => {
    if (status === "running") {
      const interval = setInterval(() => {
        setEvents(prev => {
          const recentEvents = prev.slice(0, 100);
          const botCountMap = recentEvents.reduce((map, evt) => {
            if (BOT_EVENT_TYPES.includes(evt.event_type) && evt.ip_address && evt.user_id && evt.device_id) {
              const key = `${evt.ip_address}|${evt.user_id}|${evt.device_id}`;
              map[key] = (map[key] || 0) + 1;
            }
            return map;
          }, {});

          const newBotCounts = {};
          const newEvents = Array.from({ length: EVENT_RATE_PER_SECOND }).map(() => {
            const userAddress = USER_ADDRESSES[Math.floor(Math.random() * USER_ADDRESSES.length)];
            const geo = GEOLOCATIONS[Math.floor(Math.random() * GEOLOCATIONS.length)];
            const device = DEVICE_PROFILES[Math.floor(Math.random() * DEVICE_PROFILES.length)];
            let eventType = getWeightedEventType();
            const ageGroup = randomAgeGroup();
            const userSegment = randomUserSegment(ageGroup);
            const deviceType = randomDeviceType();
            const ipAddress = `${geo.prefix}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
            const timestamp = new Date();
            const eventTimestamp = timestamp.toISOString();
            const ingestionTime = new Date(timestamp.getTime() + 1000).toISOString();
            const eventId = makeEventId();
            const userId = `user_${Math.floor(Math.random() * 9000) + 1000}`;
            const campaignId = randomChoice(CAMPAIGNS);
            const gender = randomChoice(GENDERS);
            const deviceId = `dev_${Math.floor(Math.random() * 900000) + 100000}`;
            const os = device.os.toLowerCase().includes("android")
              ? "android"
              : device.os.toLowerCase().includes("ios")
              ? "ios"
              : device.os.toLowerCase().includes("windows")
              ? "windows"
              : "macos";
            const browser = device.browser.toLowerCase().includes("chrome")
              ? "chrome"
              : device.browser.toLowerCase().includes("safari")
              ? "safari"
              : device.browser.toLowerCase();

            // Category-driven event generation
            const productCategory = getWeightedCategory();
            const categoryConfig = CATEGORY_CONFIG[productCategory];

            // Apply category-specific conversion bias
            if (eventType === "add_to_cart" && Math.random() < categoryConfig.conversionBias) {
              eventType = "order";
            }
            
            // Only calculate price for orders (revenue-bearing events)
            const price = eventType === "order" ? getCategoryPrice(productCategory) : null;
            const orderValue = eventType === "order" ? price : null;

            const key = `${ipAddress}|${userId}|${deviceId}`;
            const priorBotCount = botCountMap[key] || 0;
            const currentBotCount = newBotCounts[key] || 0;
            const isBot = BOT_EVENT_TYPES.includes(eventType) && priorBotCount + currentBotCount + 1 >= BOT_THRESHOLD;
            if (BOT_EVENT_TYPES.includes(eventType)) {
              newBotCounts[key] = currentBotCount + 1;
            }

            const isAnomaly = isBot; // Only mark as anomaly if bot detected, don't generate random anomalies
            const anomalyType = isBot ? "bot_activity" : null;

            return {
              event_id: eventId,
              event_type: eventType,
              product_category: productCategory,
              event_timestamp: eventTimestamp,
              ingestion_time: ingestionTime,
              schema_version: SCHEMA_VERSION,
              year: timestamp.getUTCFullYear(),
              month: timestamp.getUTCMonth() + 1,
              day: timestamp.getUTCDate(),
              hour: timestamp.getUTCHours(),
              campaign_id: campaignId,
              country: "India",
              region: userAddress.state,
              city: userAddress.city,
              user_id: userId,
              age_group: ageGroup,
              gender,
              user_segment: userSegment,
              device_id: deviceId,
              device_type: deviceType,
              os,
              browser,
              ip_address: ipAddress,
              price,
              order_value: orderValue,
              is_anomaly: isAnomaly,
              anomaly_type: anomalyType
            };
          });

          setCount(prev => prev + newEvents.length);
          return [...newEvents, ...prev].slice(0, 100);
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [status]);


  // pagination
  const pageSize = 100;
  const paginated = events.slice((page - 1) * pageSize, page * pageSize);

  const riskSummary = {
    anomalies: events.filter(event => event.is_anomaly).length,
    total: events.length
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>E-commerce Event Stream</h1>

      {/* TOP CONTROLS */}
      <div style={styles.grid}>
        {/* STREAM CONTROL */}
        <div style={styles.card}>
          <h3>Stream Control</h3>
          <p>Status: <span style={status === "running" ? styles.green : styles.red}>{status}</span></p>

          <button style={styles.primaryBtn} onClick={startStream}>
            ▶ Start Stream
          </button>

          <button style={styles.dangerBtn} onClick={stopStream}>
            ⏹ Stop Stream
          </button>
        </div>

        {/* ANOMALY PANEL */}
        <div style={styles.card}>
          <h3>Anomaly Injection</h3>

          <button style={styles.botBtn} onClick={() => sendAnomaly("bot_activity")}>
            🤖 Bot Attack
          </button>

          <button style={styles.warnBtn} onClick={() => sendAnomaly("fraud_order")}>
            💳 Fraud Orders
          </button>

          <button style={styles.infoBtn} onClick={() => sendAnomaly("price_spike")}>
            📈 Price Spike
          </button>
        </div>

        {/* STATS */}
        <div style={styles.card}>
          <h3>Live Metrics</h3>
          <p>Total Events: <b>{count}</b></p>
          <p>Live Rate: <b>{EVENT_RATE_PER_MINUTE.toLocaleString()}</b> events/min</p>
          <p>Events/sec: ~{EVENT_RATE_PER_SECOND}</p>
          <div style={styles.statTagRow}>
            <span style={styles.statTag}>Anomalies {riskSummary.anomalies}</span>
            <span style={styles.statTag}>Recent events {riskSummary.total}</span>
          </div>
        </div>
      </div>

      {/* EVENTS TABLE */}
      <div style={styles.tableCard}>
        <div style={styles.tableCardHeader}>
          <div>
            <h3 style={styles.sectionTitle}>Live Event Stream</h3>
            <p style={styles.sectionSubtitle}>
              India-only ecommerce event activity with campaign and user behavior details.
            </p>
          </div>
          <div style={styles.tableHeaderBadges}>
            <span style={styles.detailBadge}>{events.length} recent events</span>
            <span style={styles.detailBadge}>{pageSize} rows per page</span>
          </div>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeadRow}>
              {EVENT_FIELDS.map(field => (
                <th key={field} style={styles.tableHeader}>{field}</th>
              ))}
            </tr>
            </thead>

            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={EVENT_FIELDS.length} style={{ textAlign: "center", padding: "24px 0" }}>
                    No events yet...
                  </td>
                </tr>
              ) : (
                paginated.map(e => (
                  <tr key={e.event_id} style={styles.tableRow}>
                    {EVENT_FIELDS.map(field => (
                      <td key={field} style={styles.tableCell}>
                        {field === "event_timestamp" || field === "ingestion_time"
                          ? e[field]
                            ? new Date(e[field]).toLocaleString()
                            : "-"
                          : field === "price" || field === "last_price" || field === "mean_price" || field === "std_dev" || field === "order_value" || field === "user_avg_order_value"
                          ? typeof e[field] === "number"
                            ? e[field].toFixed(2)
                            : renderValue(e[field])
                          : renderValue(e[field])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div style={styles.pagination}>
          <button style={styles.pageBtn} disabled={page === 1} onClick={() => setPage(page - 1)}>
            Prev
          </button>

          <span>Page {page}</span>

          <button
            style={styles.pageBtn}
            disabled={page * pageSize >= events.length}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {/* INJECTED ANOMALY EVENTS */}
      <div style={styles.tableCard}>
        <div style={styles.tableCardHeader}>
          <div>
            <h3 style={styles.sectionTitle}>Injected Anomaly Events</h3>
            <p style={styles.sectionSubtitle}>
              Records created when you click an anomaly injection button.
            </p>
          </div>
          <div style={styles.tableHeaderBadges}>
            <span style={styles.detailBadge}>{anomalyEvents.length} injected anomalies</span>
          </div>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeadRow}>
              {EVENT_FIELDS.map(field => (
                <th key={field} style={styles.tableHeader}>{field}</th>
              ))}
            </tr>
            </thead>
            <tbody>
              {anomalyEvents.length === 0 ? (
                <tr>
                  <td colSpan={EVENT_FIELDS.length} style={{ textAlign: "center", padding: "24px 0" }}>
                    No anomaly injections yet...
                  </td>
                </tr>
              ) : (
                anomalyEvents.map(event => (
                  <tr key={event.event_id} style={styles.tableRow}>
                  {EVENT_FIELDS.map(field => (
                    <td key={field} style={styles.tableCell}>
                      {field === "event_timestamp" || field === "ingestion_time"
                        ? event[field]
                          ? new Date(event[field]).toLocaleString()
                          : "-"
                        : field === "price" || field === "last_price" || field === "mean_price" || field === "std_dev" || field === "order_value" || field === "user_avg_order_value"
                        ? typeof event[field] === "number"
                          ? event[field].toFixed(2)
                          : renderValue(event[field])
                        : renderValue(event[field])}
                    </td>
                  ))}
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* 🎨 STYLES */

const styles = {
  container: {
    maxWidth: "1320px",
    margin: "0 auto",
    padding: "32px 20px",
    fontFamily: "Segoe UI, sans-serif",
    background: "#eef2f7",
    minHeight: "100vh",
    color: "#27303f"
  },
  title: {
    marginBottom: "24px",
    color: "#111827",
    fontSize: "2.4rem",
    lineHeight: 1.05
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "20px",
    marginBottom: "24px"
  },

  card: {
    background: "#ffffff",
    padding: "24px",
    borderRadius: "18px",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
    minHeight: "180px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between"
  },

  tableCard: {
    background: "#ffffff",
    padding: "24px",
    borderRadius: "18px",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
    marginTop: "10px"
  },

  tableCardHeader: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "18px"
  },

  sectionTitle: {
    margin: 0,
    fontSize: "1.3rem",
    letterSpacing: "-0.02em"
  },

  sectionSubtitle: {
    marginTop: "8px",
    color: "#5b6674",
    fontSize: "0.95rem"
  },

  tableWrapper: {
    overflowX: "auto",
    marginTop: "10px"
  },

  table: {
    width: "100%",
    minWidth: "1100px",
    borderCollapse: "separate",
    borderSpacing: "0 10px",
    background: "transparent"
  },

  tableHeadRow: {
    background: "transparent"
  },

  tableHeader: {
    padding: "14px 18px",
    textAlign: "left",
    fontSize: "0.85rem",
    color: "#475569",
    fontWeight: 600,
    letterSpacing: "0.02em",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
    position: "sticky",
    top: 0,
    zIndex: 3,
    whiteSpace: "nowrap"
  },

  tableRow: {
    transition: "background 0.2s ease",
    background: "#fff"
  },

  tableCell: {
    padding: "16px 18px",
    borderBottom: "1px solid #f1f5f9",
    color: "#334155",
    fontSize: "0.95rem",
    verticalAlign: "middle"
  },

  statTagRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "18px"
  },

  statTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 14px",
    borderRadius: "999px",
    background: "#eef2ff",
    color: "#1d4ed8",
    fontSize: "0.85rem",
    fontWeight: 600
  },

  detailBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 14px",
    borderRadius: "999px",
    background: "#f3f4f6",
    color: "#475569",
    fontSize: "0.85rem",
    fontWeight: 600
  },

  tableHeaderBadges: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "10px",
    flexWrap: "wrap"
  },

  primaryBtn: {
    background: "#2563eb",
    color: "#fff",
    padding: "12px 18px",
    marginRight: "12px",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(37, 99, 235, 0.18)",
    transition: "transform 0.2s ease, background 0.2s ease"
  },

  secondaryBtn: {
    background: "#475569",
    color: "#fff",
    padding: "12px 18px",
    marginRight: "12px",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(71, 85, 105, 0.16)",
    transition: "transform 0.2s ease, background 0.2s ease"
  },

  dangerBtn: {
    background: "#dc2626",
    color: "#fff",
    padding: "12px 18px",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(220, 38, 38, 0.16)",
    transition: "transform 0.2s ease, background 0.2s ease"
  },

  botBtn: {
    background: "#7c3aed",
    color: "#fff",
    padding: "12px 18px",
    marginRight: "12px",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "transform 0.2s ease, background 0.2s ease"
  },

  warnBtn: {
    background: "#f97316",
    color: "#fff",
    padding: "12px 18px",
    marginRight: "12px",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "transform 0.2s ease, background 0.2s ease"
  },

  infoBtn: {
    background: "#0ea5e9",
    color: "#fff",
    padding: "12px 18px",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer"
  },

  pagination: {
    marginTop: "18px",
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "center"
  },

  pageBtn: {
    background: "#ffffff",
    color: "#334155",
    padding: "10px 18px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "background 0.2s ease, border-color 0.2s ease",
    minWidth: "82px"
  },

  green: { color: "#16a34a" },
  red: { color: "#dc2626" },

  riskTag: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "0.82rem",
    fontWeight: 700,
    color: "#111827",
    background: "#f8fafc",
    border: "1px solid #e2e8f0"
  }
};