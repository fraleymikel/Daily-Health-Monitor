import { useState, useEffect } from 'react';
import { getCheckinHistory, getCheckinDetail } from '../services/api';

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await getCheckinHistory(60);
      setHistory(data);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
    setLoading(false);
  };

  const handleSelect = async (id: number) => {
    if (selected?.id === id) {
      setSelected(null);
      return;
    }
    try {
      const detail = await getCheckinDetail(id);
      setSelected(detail);
    } catch (err) {
      console.error('Failed to load detail:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) return 'Today';
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return <div className="empty-state"><p>Loading history...</p></div>;
  }

  if (history.length === 0) {
    return (
      <div className="empty-state">
        <h2>No Check-ins Yet</h2>
        <p>Your check-in history will appear here once you start logging.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Check-in History</h1>
        <p>{history.length} entries</p>
      </div>

      {history.map(item => (
        <div key={item.id}>
          <div className="history-item" onClick={() => handleSelect(item.id)}>
            <div>
              <div className="date">{formatDate(item.date)}</div>
              {item.summary && (
                <div className="summary">{item.summary.slice(0, 80)}...</div>
              )}
            </div>
            <span className={`badge ${item.completed_at ? 'complete' : 'incomplete'}`}>
              {item.completed_at ? 'Complete' : 'Partial'}
            </span>
          </div>

          {selected?.id === item.id && (
            <div style={{ padding: '0 12px 16px' }}>
              <div className="chart-card" style={{ marginTop: 8 }}>
                {selected.responses?.map((r: any, i: number) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {r.category}
                    </div>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: 2 }}>
                      {r.question}
                    </div>
                    <div style={{ color: 'var(--primary)', fontSize: '0.95rem' }}>
                      {r.answer}
                    </div>
                  </div>
                ))}

                {selected.weather && (
                  <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                      Weather
                    </div>
                    <div style={{ fontSize: '0.9rem' }}>
                      {selected.weather.weather_description} |
                      {' '}{Math.round(selected.weather.temperature_high)}°F / {Math.round(selected.weather.temperature_low)}°F |
                      {' '}Humidity {selected.weather.humidity}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
