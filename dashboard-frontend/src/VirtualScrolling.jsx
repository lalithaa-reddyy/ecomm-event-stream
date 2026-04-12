import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * VirtualEventTable: Renders only visible rows using virtual scrolling
 * Reduces rendered DOM nodes from 100+ to ~20, improving performance 5-10x
 * 
 * Props:
 *   - events: array of event objects
 *   - fields: array of field names to display
 *   - onRowClick: callback when row is clicked
 */
export function VirtualEventTable({ events = [], fields = [], onRowClick = null }) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  
  // Configuration
  const ROW_HEIGHT = 40;
  const BUFFER_SIZE = 5;  // Extra rows to render outside viewport
  const CONTAINER_HEIGHT = 600;
  
  // Calculate which rows to render
  const startIndex = Math.max(0, Math.floor((scrollTop - BUFFER_SIZE * ROW_HEIGHT) / ROW_HEIGHT));
  const endIndex = Math.min(
    events.length,
    Math.ceil((scrollTop + CONTAINER_HEIGHT + BUFFER_SIZE * ROW_HEIGHT) / ROW_HEIGHT)
  );
  
  const visibleEvents = useMemo(() => events.slice(startIndex, endIndex), [events, startIndex, endIndex]);
  const offsetY = startIndex * ROW_HEIGHT;
  
  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);
  
  const formatValue = (value, field) => {
    if (value === null || value === undefined) return '-';
    if (field.includes('timestamp') && typeof value === 'string') {
      return new Date(value).toLocaleTimeString();
    }
    if (field.includes('price') || field.includes('value') || field.includes('revenue')) {
      return typeof value === 'number' ? `Rs ${value.toFixed(2)}` : value;
    }
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value).slice(0, 50);  // Truncate long strings
  };
  
  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height: CONTAINER_HEIGHT,
        overflowY: 'auto',
        overflowX: 'auto',
        background: '#1a1d2e',
        borderRadius: 8,
        border: '1px solid #2d3748'
      }}
    >
      <table style={{
        width: 'max(100%, ' + (fields.length * 120) + 'px)',
        borderCollapse: 'collapse',
        fontSize: 12
      }}>
        <thead style={{ position: 'sticky', top: 0, background: '#0f1419', zIndex: 10 }}>
          <tr>
            {fields.map(field => (
              <th
                key={field}
                style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  color: '#718096',
                  fontWeight: 600,
                  borderBottom: '1px solid #2d3748',
                  minWidth: 100,
                  whiteSpace: 'nowrap'
                }}
              >
                {field}
              </th>
            ))}
          </tr>
        </thead>
        
        <tbody style={{
          transform: `translateY(${offsetY}px)`,
          transition: 'none'
        }}>
          {visibleEvents.length === 0 ? (
            <tr style={{ height: events.length === 0 ? CONTAINER_HEIGHT : undefined }}>
              <td colSpan={fields.length} style={{ textAlign: 'center', padding: '20px' }}>
                {events.length === 0 ? 'No events yet' : 'Loading...'}
              </td>
            </tr>
          ) : (
            visibleEvents.map((event, idx) => (
              <tr
                key={event.event_id || startIndex + idx}
                onClick={() => onRowClick?.(event)}
                style={{
                  height: ROW_HEIGHT,
                  borderBottom: '1px solid #1e2232',
                  cursor: onRowClick ? 'pointer' : 'default',
                  background: event.is_anomaly ? '#3b1f1f' : '#0f1419'
                }}
              >
                {fields.map(field => (
                  <td
                    key={field}
                    style={{
                      padding: '8px 12px',
                      color: event.is_anomaly ? '#fc8181' : '#a0aec0',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      minWidth: 100
                    }}
                  >
                    {formatValue(event[field], field)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      
      {/* Spacer to maintain scroll height */}
      <div style={{ height: Math.max(0, events.length - endIndex) * ROW_HEIGHT }} />
    </div>
  );
}

/**
 * Simple infinite scroll pagination wrapper
 * Automatically loads more items when user reaches bottom
 */
export function InfiniteScrollContainer({ 
  items, 
  hasMore, 
  onLoadMore, 
  isLoading,
  children 
}) {
  const containerRef = useRef(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !isLoading) {
        onLoadMore?.();
      }
    }, { threshold: 0.1 });
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore]);
  
  return (
    <div>
      {children}
      {hasMore && <div ref={containerRef} style={{ padding: '20px', textAlign: 'center', color: '#718096' }}>
        {isLoading ? 'Loading more...' : 'Scroll for more'}
      </div>}
      {!hasMore && <div style={{ padding: '20px', textAlign: 'center', color: '#4a5568', fontSize: 12 }}>
        No more items
      </div>}
    </div>
  );
}

/**
 * Compact event summary - shows only essential fields
 * Useful as a quick preview before expanding details
 */
export function EventSummary({ event, onExpand }) {
  const PREVIEW_FIELDS = [
    'event_type',
    'product_category',
    'campaign_id',
    'order_value',
    'is_anomaly'
  ];
  
  return (
    <div
      onClick={() => onExpand?.(event)}
      style={{
        padding: '12px 16px',
        background: '#1a1d2e',
        border: '1px solid #2d3748',
        borderRadius: 6,
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#3d4a5f'}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#2d3748'}
    >
      <div style={{ display: 'flex', gap: 16, flex: 1, fontSize: 12 }}>
        {PREVIEW_FIELDS.map(field => (
          <div key={field}>
            <div style={{ color: '#4a5568', fontSize: 10, textTransform: 'uppercase' }}>
              {field}
            </div>
            <div style={{ color: event.is_anomaly ? '#fc8181' : '#e2e8f0', fontWeight: 600 }}>
              {String(event[field] || '-').slice(0, 20)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ cursor: 'pointer', color: '#718096' }}>→</div>
    </div>
  );
}
