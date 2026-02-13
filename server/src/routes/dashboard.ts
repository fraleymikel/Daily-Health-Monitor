import { Router, Request, Response } from 'express';
import { getDb } from '../models/database';
import { getInsights, dismissInsight, analyzePatterns } from '../services/patterns';

const router = Router();

// Get dashboard summary
router.get('/summary', (req: Request, res: Response) => {
  const db = getDb();
  const days = parseInt(req.query.days as string) || 30;

  // Get metric trends over time
  const metrics = db.prepare(`
    SELECT date, metric_name, numeric_value, category
    FROM daily_metrics
    WHERE numeric_value IS NOT NULL
      AND date >= date('now', '-' || ? || ' days')
    ORDER BY date
  `).all(days) as Array<{ date: string; metric_name: string; numeric_value: number; category: string }>;

  // Group by date for chart data
  const byDate: Record<string, Record<string, number>> = {};
  for (const m of metrics) {
    if (!byDate[m.date]) byDate[m.date] = {};
    byDate[m.date][m.metric_name] = m.numeric_value;
  }

  // Get streak
  const checkins = db.prepare(`
    SELECT date FROM checkins WHERE completed_at IS NOT NULL ORDER BY date DESC
  `).all() as Array<{ date: string }>;

  let streak = 0;
  const todayDate = new Date();
  for (let i = 0; i < checkins.length; i++) {
    const expected = new Date(todayDate);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split('T')[0];
    if (checkins[i].date === expectedStr) {
      streak++;
    } else {
      break;
    }
  }

  // Get weather correlation data
  const weatherMetrics = db.prepare(`
    SELECT w.date, w.temperature_high, w.humidity, w.precipitation, w.pressure,
           dm.metric_name, dm.numeric_value
    FROM weather w
    JOIN daily_metrics dm ON w.date = dm.date
    WHERE dm.numeric_value IS NOT NULL
      AND w.date >= date('now', '-' || ? || ' days')
    ORDER BY w.date
  `).all(days);

  // Averages
  const averages: Record<string, { sum: number; count: number }> = {};
  for (const m of metrics) {
    if (!averages[m.metric_name]) averages[m.metric_name] = { sum: 0, count: 0 };
    averages[m.metric_name].sum += m.numeric_value;
    averages[m.metric_name].count++;
  }
  const avgResult: Record<string, number> = {};
  for (const [name, { sum, count }] of Object.entries(averages)) {
    avgResult[name] = Math.round((sum / count) * 10) / 10;
  }

  res.json({
    chart_data: Object.entries(byDate).map(([date, metrics]) => ({ date, ...metrics })).sort((a, b) => a.date.localeCompare(b.date)),
    averages: avgResult,
    streak,
    total_checkins: checkins.length,
    weather_data: weatherMetrics,
  });
});

// Get insights
router.get('/insights', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const insights = getInsights(limit);
  res.json(insights);
});

// Refresh insights (re-run analysis)
router.post('/insights/refresh', (req: Request, res: Response) => {
  const insights = analyzePatterns();
  res.json(insights);
});

// Dismiss an insight
router.post('/insights/:id/dismiss', (req: Request, res: Response) => {
  dismissInsight(parseInt(req.params.id as string));
  res.json({ success: true });
});

export default router;
