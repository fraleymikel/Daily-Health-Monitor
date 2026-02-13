import { useState, useEffect } from 'react';
import { getDashboardSummary, getInsights, dismissInsight as dismissInsightApi, refreshInsights } from '../services/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const METRIC_COLORS: Record<string, string> = {
  overall_mood: '#4a90d9',
  sleep_quality: '#8e44ad',
  energy_level: '#f39c12',
  stress_level: '#e74c3c',
  water_intake: '#27ae60',
  sleep_hours: '#3498db',
  meal_quality: '#2ecc71',
  screen_time: '#95a5a6',
  outdoor_time: '#1abc9c',
};

const METRIC_LABELS: Record<string, string> = {
  overall_mood: 'Mood',
  sleep_quality: 'Sleep Quality',
  energy_level: 'Energy',
  stress_level: 'Stress',
  water_intake: 'Water (glasses)',
  sleep_hours: 'Sleep (hrs)',
  meal_quality: 'Diet Quality',
  screen_time: 'Screen Time (hrs)',
  outdoor_time: 'Outdoor Time',
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadData();
  }, [days]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sum, ins] = await Promise.all([
        getDashboardSummary(days),
        getInsights(),
      ]);
      setSummary(sum);
      setInsights(ins);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
    setLoading(false);
  };

  const handleDismiss = async (id: number) => {
    await dismissInsightApi(id);
    setInsights(prev => prev.filter(i => i.id !== id));
  };

  const handleRefresh = async () => {
    const newInsights = await refreshInsights();
    setInsights(newInsights);
  };

  if (loading) {
    return (
      <div className="empty-state">
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  if (!summary || summary.total_checkins === 0) {
    return (
      <div className="empty-state">
        <h2>No Data Yet</h2>
        <p>Complete your first daily check-in to start seeing patterns and insights here.</p>
      </div>
    );
  }

  const chartMetrics = ['overall_mood', 'energy_level', 'stress_level', 'sleep_quality'];
  const availableMetrics = chartMetrics.filter(m => summary.averages[m] != null);

  return (
    <div>
      <div className="page-header">
        <h1>Your Dashboard</h1>
        <p>
          {summary.total_checkins} check-ins tracked
          {summary.streak > 0 && ` | ${summary.streak}-day streak`}
        </p>
      </div>

      {/* Quick stats */}
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="value">{summary.streak}</div>
          <div className="label">Day Streak</div>
        </div>
        <div className="stat-card">
          <div className="value">{summary.total_checkins}</div>
          <div className="label">Total Check-ins</div>
        </div>
        {summary.averages.overall_mood != null && (
          <div className="stat-card">
            <div className="value">{summary.averages.overall_mood}/10</div>
            <div className="label">Avg Mood</div>
          </div>
        )}
        {summary.averages.energy_level != null && (
          <div className="stat-card">
            <div className="value">{summary.averages.energy_level}/10</div>
            <div className="label">Avg Energy</div>
          </div>
        )}
      </div>

      {/* Time range selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[7, 14, 30, 90].map(d => (
          <button
            key={d}
            className="choice-btn"
            style={d === days ? { background: 'var(--primary)', color: 'white' } : {}}
            onClick={() => setDays(d)}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Trend chart */}
      {summary.chart_data.length > 1 && (
        <div className="chart-card">
          <h3>Trends Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={summary.chart_data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                fontSize={12}
              />
              <YAxis domain={[0, 10]} fontSize={12} />
              <Tooltip
                labelFormatter={(d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              />
              <Legend />
              {availableMetrics.map(metric => (
                <Line
                  key={metric}
                  type="monotone"
                  dataKey={metric}
                  name={METRIC_LABELS[metric] || metric}
                  stroke={METRIC_COLORS[metric] || '#999'}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Secondary chart: water + sleep hours */}
      {summary.chart_data.length > 1 && (summary.averages.water_intake != null || summary.averages.sleep_hours != null) && (
        <div className="chart-card">
          <h3>Hydration & Sleep</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={summary.chart_data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                fontSize={12}
              />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              {summary.averages.water_intake != null && (
                <Line type="monotone" dataKey="water_intake" name="Water (glasses)" stroke="#27ae60" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              )}
              {summary.averages.sleep_hours != null && (
                <Line type="monotone" dataKey="sleep_hours" name="Sleep (hours)" stroke="#3498db" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Insights section */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.2rem' }}>Patterns & Insights</h1>
          <p>Based on your data, here's what I'm noticing</p>
        </div>
        <button className="choice-btn" onClick={handleRefresh}>Refresh</button>
      </div>

      {insights.length === 0 ? (
        <div className="insight-card">
          <div className="pattern">Not enough data yet to find patterns. Keep checking in daily - I'll start spotting trends after about a week.</div>
        </div>
      ) : (
        insights.map(insight => (
          <div
            key={insight.id}
            className={`insight-card ${insight.correlation_strength > 0.5 ? 'strong' : insight.correlation_strength < -0.3 ? 'negative' : ''}`}
          >
            <div className="pattern">{insight.description}</div>
            {insight.suggestion && <div className="suggestion">{insight.suggestion}</div>}
            <button className="dismiss-btn" onClick={() => handleDismiss(insight.id)}>
              Got it
            </button>
          </div>
        ))
      )}
    </div>
  );
}
