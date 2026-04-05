import { useState, useEffect } from "react";

const Dashboard = ({ apiEndpoint }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${apiEndpoint}/stream`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        setMetrics(data);
        setLastUpdate(new Date().toLocaleTimeString());
        setError(null);
      } catch (err) {
        setError(err.message);
        console.error('Failed to fetch metrics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000); // Refresh every 3 seconds
    return () => clearInterval(interval);
  }, [apiEndpoint]);

  const styles = {
    dashboardContainer: {
      padding: '20px',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
      marginTop: '20px'
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      marginBottom: '20px',
      color: '#333'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '20px',
      marginBottom: '20px'
    },
    card: {
      backgroundColor: 'white',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid #e0e0e0'
    },
    cardTitle: {
      fontSize: '18px',
      fontWeight: 'bold',
      marginBottom: '15px',
      color: '#333',
      borderBottom: '2px solid #007bff',
      paddingBottom: '10px'
    },
    metric: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: '1px solid #f0f0f0',
      fontSize: '14px'
    },
    metricLabel: {
      color: '#666',
      fontWeight: '500'
    },
    metricValue: {
      color: '#007bff',
      fontWeight: 'bold',
      fontSize: '16px'
    },
    eventTypeList: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '10px'
    },
    eventTypeBadge: {
      backgroundColor: '#e7f3ff',
      padding: '10px',
      borderRadius: '4px',
      fontSize: '13px',
      border: '1px solid #b3d9ff'
    },
    eventTypeName: {
      fontWeight: 'bold',
      color: '#0066cc'
    },
    eventTypeCount: {
      fontSize: '18px',
      color: '#007bff',
      marginTop: '5px'
    },
    recentMinutesContainer: {
      maxHeight: '400px',
      overflowY: 'auto'
    },
    minuteItem: {
      padding: '10px',
      marginBottom: '10px',
      backgroundColor: '#f9f9f9',
      borderRadius: '4px',
      fontSize: '12px',
      border: '1px solid #e0e0e0'
    },
    minuteTime: {
      fontWeight: 'bold',
      color: '#333',
      marginBottom: '5px'
    },
    minuteData: {
      color: '#666',
      fontSize: '11px'
    },
    loadingMessage: {
      textAlign: 'center',
      padding: '20px',
      color: '#999'
    },
    errorMessage: {
      backgroundColor: '#ffe0e0',
      color: '#d32f2f',
      padding: '15px',
      borderRadius: '4px',
      marginBottom: '20px',
      border: '1px solid #f44336'
    },
    lastUpdate: {
      fontSize: '12px',
      color: '#999',
      marginTop: '15px',
      textAlign: 'right'
    },
    statusBadge: {
      display: 'inline-block',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 'bold',
      marginLeft: '10px'
    },
    statusLive: {
      backgroundColor: '#d4edda',
      color: '#155724'
    },
    statusNoData: {
      backgroundColor: '#fff3cd',
      color: '#856404'
    }
  };

  if (error) {
    return (
      <div style={styles.dashboardContainer}>
        <div style={styles.errorMessage}>
          ⚠️ Failed to load metrics: {error}
        </div>
      </div>
    );
  }

  if (loading || !metrics) {
    return (
      <div style={styles.dashboardContainer}>
        <div style={styles.loadingMessage}>Loading metrics...</div>
      </div>
    );
  }

  return (
    <div style={styles.dashboardContainer}>
      <div style={styles.title}>
        📊 Real-Time Dashboard
        <span style={{
          ...styles.statusBadge,
          ...(metrics.totalEvents > 0 ? styles.statusLive : styles.statusNoData)
        }}>
          {metrics.totalEvents > 0 ? '● LIVE' : '● IDLE'}
        </span>
      </div>

      <div style={styles.grid}>
        {/* TOTAL EVENTS CARD */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>📈 Total Events</div>
          <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#007bff', marginBottom: '10px' }}>
            {metrics.totalEvents.toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            Across {metrics.dataPoints} minute(s)
          </div>
        </div>

        {/* EVENT TYPES CARD */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>📊 Events by Type</div>
          <div style={styles.eventTypeList}>
            {Object.entries(metrics.eventsByType).map(([type, count]) => (
              <div key={type} style={styles.eventTypeBadge}>
                <div style={styles.eventTypeName}>
                  {type.replace(/_/g, ' ').toUpperCase()}
                </div>
                <div style={styles.eventTypeCount}>
                  {count.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
          {Object.keys(metrics.eventsByType).length === 0 && (
            <div style={{ color: '#999', fontSize: '12px' }}>No events yet</div>
          )}
        </div>

        {/* STATS CARD */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>📌 Summary</div>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Data Points:</span>
            <span style={styles.metricValue}>{metrics.dataPoints}</span>
          </div>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Event Types Tracked:</span>
            <span style={styles.metricValue}>{Object.keys(metrics.eventsByType).length}</span>
          </div>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Avg Events/Minute:</span>
            <span style={styles.metricValue}>
              {metrics.dataPoints > 0 ? Math.round(metrics.totalEvents / metrics.dataPoints).toLocaleString() : '0'}
            </span>
          </div>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Last Updated:</span>
            <span style={styles.metricValue}>{lastUpdate}</span>
          </div>
        </div>
      </div>

      {/* RECENT MINUTES CARD */}
      {metrics.recentMinutes && metrics.recentMinutes.length > 0 && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>⏰ Recent Minutes (Last {metrics.recentMinutes.length})</div>
          <div style={styles.recentMinutesContainer}>
            {metrics.recentMinutes.map((minute, idx) => (
              <div key={idx} style={styles.minuteItem}>
                <div style={styles.minuteTime}>
                  {minute.id || 'Unknown'} | {minute.lastSeen || 'No timestamp'}
                </div>
                <div style={styles.minuteData}>
                  Total: {minute.total || 0} | 
                  {Object.entries(minute)
                    .filter(([k, v]) => k !== 'id' && k !== 'lastSeen' && k !== 'total' && typeof v === 'number')
                    .map(([k, v]) => ` ${k}: ${v}`)
                    .join(' |')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={styles.lastUpdate}>
        🔄 Auto-refreshing every 3 seconds | Last update: {lastUpdate}
      </div>
    </div>
  );
};

export default Dashboard;
