import { getDb } from '../models/database';

interface MetricRow {
  date: string;
  metric_name: string;
  numeric_value: number | null;
  text_value: string | null;
  category: string;
}

interface WeatherRow {
  date: string;
  temperature_high: number;
  temperature_low: number;
  humidity: number;
  precipitation: number;
  weather_code: number;
  uv_index: number;
  pressure: number;
}

interface Insight {
  pattern_type: string;
  description: string;
  suggestion: string;
  variables: string;
  correlation_strength: number;
  data_points: number;
}

// Simple Pearson correlation
function correlate(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 5) return 0; // Need minimum data points
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

// Find rolling average trends
function trend(values: number[]): 'improving' | 'declining' | 'stable' {
  if (values.length < 5) return 'stable';
  const recent = values.slice(-5);
  const older = values.slice(-10, -5);
  if (older.length < 3) return 'stable';
  const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
  const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
  const diff = avgRecent - avgOlder;
  if (Math.abs(diff) < 0.5) return 'stable';
  return diff > 0 ? 'improving' : 'declining';
}

const FRIENDLY_NAMES: Record<string, string> = {
  overall_mood: 'mood',
  sleep_quality: 'sleep quality',
  sleep_hours: 'sleep duration',
  energy_level: 'energy',
  meal_quality: 'diet quality',
  water_intake: 'water intake',
  stress_level: 'stress',
  screen_time: 'screen time',
  outdoor_time: 'outdoor time',
  cycle_day: 'cycle day',
  temperature_high: 'temperature',
  humidity: 'humidity',
  precipitation: 'rain',
  pressure: 'barometric pressure',
  uv_index: 'UV index',
};

function friendly(name: string): string {
  return FRIENDLY_NAMES[name] || name.replace(/_/g, ' ');
}

function generateSuggestion(metric1: string, metric2: string, r: number): string {
  const m1 = friendly(metric1);
  const m2 = friendly(metric2);
  const direction = r > 0 ? 'positively' : 'negatively';

  // Specific suggestions based on known patterns
  if (metric1 === 'sleep_hours' && metric2 === 'overall_mood') {
    return r > 0
      ? 'Getting more sleep seems to boost your mood. Try to maintain a consistent bedtime.'
      : 'Interestingly, more sleep correlates with lower mood. You might be oversleeping on rough days - focus on sleep quality over quantity.';
  }
  if (metric1 === 'water_intake' && (metric2 === 'energy_level' || metric2 === 'overall_mood')) {
    return `Staying hydrated seems to help your ${m2}. Try keeping a water bottle nearby throughout the day.`;
  }
  if (metric1 === 'stress_level' && metric2 === 'sleep_quality') {
    return 'High stress is affecting your sleep. Consider a wind-down routine before bed - no screens, light stretching, or journaling.';
  }
  if (metric1 === 'screen_time' && (metric2 === 'sleep_quality' || metric2 === 'stress_level')) {
    return `More screen time seems to affect your ${m2}. Try setting a screen curfew an hour before bed.`;
  }
  if (metric1 === 'outdoor_time' && metric2 === 'overall_mood') {
    return 'Time outdoors is linked to better mood for you. Even a 15-minute walk can make a difference.';
  }
  if (metric1.startsWith('temperature') || metric1 === 'humidity' || metric1 === 'pressure') {
    return `${friendly(metric1)} seems to affect your ${m2}. On days with challenging weather, plan ahead with extra self-care.`;
  }

  // Generic suggestion
  return `Your ${m1} and ${m2} are ${direction} correlated. Pay attention to how changes in ${m1} affect your ${m2}.`;
}

export function analyzePatterns(): Insight[] {
  const db = getDb();
  const insights: Insight[] = [];

  // Get all numeric metrics grouped by date
  const metricsRaw = db.prepare(`
    SELECT date, metric_name, numeric_value, category
    FROM daily_metrics
    WHERE numeric_value IS NOT NULL
    ORDER BY date
  `).all() as MetricRow[];

  // Get weather data
  const weatherRaw = db.prepare(`
    SELECT date, temperature_high, temperature_low, humidity, precipitation, weather_code, uv_index, pressure
    FROM weather
    ORDER BY date
  `).all() as WeatherRow[];

  // Build per-date metric maps
  const dateMetrics: Record<string, Record<string, number>> = {};
  for (const row of metricsRaw) {
    if (row.numeric_value == null) continue;
    if (!dateMetrics[row.date]) dateMetrics[row.date] = {};
    dateMetrics[row.date][row.metric_name] = row.numeric_value;
  }

  // Merge weather into date metrics
  for (const w of weatherRaw) {
    if (!dateMetrics[w.date]) dateMetrics[w.date] = {};
    dateMetrics[w.date]['temperature_high'] = w.temperature_high;
    dateMetrics[w.date]['humidity'] = w.humidity;
    dateMetrics[w.date]['precipitation'] = w.precipitation;
    dateMetrics[w.date]['pressure'] = w.pressure;
    dateMetrics[w.date]['uv_index'] = w.uv_index;
  }

  const dates = Object.keys(dateMetrics).sort();
  if (dates.length < 5) return insights; // Need minimum data

  // Collect all metric names
  const allMetrics = new Set<string>();
  for (const d of dates) {
    for (const m of Object.keys(dateMetrics[d])) {
      allMetrics.add(m);
    }
  }

  const metricNames = Array.from(allMetrics);
  // Outcome metrics we want to explain
  const outcomes = ['overall_mood', 'sleep_quality', 'energy_level', 'stress_level'];

  // Cross-correlate each input metric with outcomes
  for (const outcome of outcomes) {
    for (const input of metricNames) {
      if (input === outcome) continue;

      // Gather paired observations
      const xs: number[] = [];
      const ys: number[] = [];
      for (const d of dates) {
        const x = dateMetrics[d][input];
        const y = dateMetrics[d][outcome];
        if (x != null && y != null) {
          xs.push(x);
          ys.push(y);
        }
      }

      if (xs.length < 5) continue;

      const r = correlate(xs, ys);
      const absR = Math.abs(r);

      // Only report meaningful correlations
      if (absR >= 0.3) {
        const direction = r > 0 ? 'positively' : 'negatively';
        insights.push({
          pattern_type: 'correlation',
          description: `Your ${friendly(input)} is ${direction} correlated with your ${friendly(outcome)} (r=${r.toFixed(2)} across ${xs.length} days).`,
          suggestion: generateSuggestion(input, outcome, r),
          variables: JSON.stringify([input, outcome]),
          correlation_strength: r,
          data_points: xs.length,
        });
      }
    }
  }

  // Trend analysis for each outcome
  for (const outcome of outcomes) {
    const values = dates.map(d => dateMetrics[d][outcome]).filter(v => v != null) as number[];
    const t = trend(values);
    if (t !== 'stable' && values.length >= 7) {
      const direction = t === 'improving' ? 'improving' : 'declining';
      const emoji = t === 'improving' ? 'upward' : 'downward';
      insights.push({
        pattern_type: 'trend',
        description: `Your ${friendly(outcome)} has been ${direction} over the past week.`,
        suggestion: t === 'improving'
          ? `Great job! Whatever you've been doing for your ${friendly(outcome)} is working. Keep it up!`
          : `Your ${friendly(outcome)} has been trending down. Look at what's changed recently and consider small adjustments.`,
        variables: JSON.stringify([outcome]),
        correlation_strength: t === 'improving' ? 0.5 : -0.5,
        data_points: values.length,
      });
    }
  }

  // Sort by absolute correlation strength
  insights.sort((a, b) => Math.abs(b.correlation_strength) - Math.abs(a.correlation_strength));

  // Save new insights to database
  const existingInsights = db.prepare('SELECT variables, pattern_type FROM insights WHERE dismissed = 0').all() as any[];
  const existingKeys = new Set(existingInsights.map((i: any) => `${i.pattern_type}:${i.variables}`));

  const insert = db.prepare(`
    INSERT INTO insights (pattern_type, description, suggestion, variables, correlation_strength, data_points)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const insight of insights) {
    const key = `${insight.pattern_type}:${insight.variables}`;
    if (!existingKeys.has(key)) {
      insert.run(insight.pattern_type, insight.description, insight.suggestion, insight.variables, insight.correlation_strength, insight.data_points);
    }
  }

  return insights;
}

export function getInsights(limit: number = 10): any[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM insights
    WHERE dismissed = 0
    ORDER BY ABS(correlation_strength) DESC, discovered_at DESC
    LIMIT ?
  `).all(limit);
}

export function dismissInsight(id: number): void {
  const db = getDb();
  db.prepare('UPDATE insights SET dismissed = 1 WHERE id = ?').run(id);
}
