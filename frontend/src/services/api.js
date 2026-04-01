// src/services/api.js

const API_BASE = "https://your-api-id.execute-api.us-east-1.amazonaws.com/prod";
const GENDERS = ["male", "female"];
const CURRENCY_RULES = {
  India: { currency: "INR", min: 250, max: 25000 },
  US: { currency: "USD", min: 5, max: 550 },
  UK: { currency: "GBP", min: 5, max: 420 }
};
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
const EVENT_TYPES = ["page_view", "order", "cart", "checkout", "login"];
const USER_ADDRESSES = [
  {
    street: "12 MG Road",
    city: "Bengaluru",
    state: "Karnataka",
    postal_code: "560001",
    country: "India"
  },
  {
    street: "5 Bandra Kurla Complex",
    city: "Mumbai",
    state: "Maharashtra",
    postal_code: "400051",
    country: "India"
  },
  {
    street: "200 Broadway",
    city: "New York",
    state: "New York",
    postal_code: "10007",
    country: "US"
  },
  {
    street: "1 Market St",
    city: "San Francisco",
    state: "California",
    postal_code: "94105",
    country: "US"
  },
  {
    street: "221B Baker Street",
    city: "London",
    state: "England",
    postal_code: "NW1 6XE",
    country: "UK"
  },
  {
    street: "10 Deansgate",
    city: "Manchester",
    state: "England",
    postal_code: "M3 1BB",
    country: "UK"
  }
];
const GEOLOCATIONS = [
  {
    prefix: "14.139",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India",
    latitude: 12.9716,
    longitude: 77.5946,
    type: "residential"
  },
  {
    prefix: "103.9",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    latitude: 19.076,
    longitude: 72.8777,
    type: "residential"
  },
  {
    prefix: "34.0",
    city: "New York",
    state: "New York",
    country: "US",
    latitude: 40.7128,
    longitude: -74.006,
    type: "residential"
  },
  {
    prefix: "34.201",
    city: "San Francisco",
    state: "California",
    country: "US",
    latitude: 37.7749,
    longitude: -122.4194,
    type: "residential"
  },
  {
    prefix: "51.15",
    city: "London",
    state: "England",
    country: "UK",
    latitude: 51.5074,
    longitude: -0.1278,
    type: "residential"
  },
  {
    prefix: "51.48",
    city: "Manchester",
    state: "England",
    country: "UK",
    latitude: 53.4808,
    longitude: -2.2426,
    type: "residential"
  }
];

export const startStream = (rate = 10000) => {
  return fetch(`${API_BASE}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rate })
  }).then(res => res.json());
};

export const stopStream = () => {
  return fetch(`${API_BASE}/stop`, {
    method: "POST"
  }).then(res => res.json());
};

export const sendAnomaly = (type) => {
  return fetch(`${API_BASE}/anomaly`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type })
  }).then(res => res.json());
};

// Mock paginated events (replace later with real API)
export const fetchEvents = (page = 1, limit = 20) => {
  const events = [];

  for (let i = 0; i < limit; i++) {
    const userAddress = USER_ADDRESSES[Math.floor(Math.random() * USER_ADDRESSES.length)];
    const billingSameAsShipping = Math.random() > 0.15;
    const shippingAddress = billingSameAsShipping
      ? userAddress
      : USER_ADDRESSES[Math.floor(Math.random() * USER_ADDRESSES.length)];
    const geo = GEOLOCATIONS[Math.floor(Math.random() * GEOLOCATIONS.length)];
    const device = DEVICE_PROFILES[Math.floor(Math.random() * DEVICE_PROFILES.length)];
    const eventType = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
    const ipAddress = `${geo.prefix}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
    const currencyRule = CURRENCY_RULES[geo.country] || CURRENCY_RULES.US;
    const amount = Math.floor(Math.random() * (currencyRule.max - currencyRule.min + 1)) + currencyRule.min;

    events.push({
      event_id: `${page}-${i}-${Math.random().toString(36).slice(2)}`,
      user_id: Math.floor(Math.random() * 10000),
      session_id: `sess-${Math.random().toString(36).slice(2)}`,
      device_id: `device-${Math.floor(Math.random() * 100000)}`,
      device,
      ip_address: ipAddress,
      ip_geo: {
        city: geo.city,
        state: geo.state,
        country: geo.country,
        latitude: geo.latitude,
        longitude: geo.longitude,
        type: geo.type
      },
      user: {
        first_name: ["Amina", "Raj", "Liam", "Olivia", "Noah", "Priya"][Math.floor(Math.random() * 6)],
        last_name: ["Sharma", "Patel", "Smith", "Johnson", "Williams", "Khan"][Math.floor(Math.random() * 6)],
        age: ["18-25", "26-35", "36-50"][Math.floor(Math.random() * 3)],
        gender: GENDERS[Math.floor(Math.random() * GENDERS.length)],
        email: `user${Math.floor(Math.random() * 100000)}@example.com`,
        phone: `+${Math.floor(Math.random() * 50) + 1}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
        address: userAddress
      },
      billing_address: userAddress,
      shipping_address: shippingAddress,
      order_id: eventType === "order" ? `order-${Math.random().toString(36).slice(2)}` : null,
      event_type: eventType,
      event_category: eventType === "order" ? "transaction" : eventType === "cart" ? "basket" : eventType,
      product: {
        category: ["electronics", "fashion", "home", "beauty"][Math.floor(Math.random() * 4)],
        sku: `sku-${Math.floor(Math.random() * 100000)}`,
        amount,
        currency: currencyRule.currency
      },
      amount,
      currency: currencyRule.currency,
      region: {
        city: userAddress.city,
        state: userAddress.state,
        country: userAddress.country
      },
      timestamp: new Date().toISOString(),
      risk_factors: {
        ip_country_mismatch: geo.country !== userAddress.country,
        billing_shipping_mismatch: shippingAddress !== userAddress,
        proxy_ip: geo.type === "datacenter"
      }
    });
  }

  return Promise.resolve({
    data: events,
    totalPages: 50
  });
};