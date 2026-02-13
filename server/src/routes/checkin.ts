import { Router, Request, Response } from 'express';
import { getDb } from '../models/database';
import { getNextQuestion, getQuestionFlow, extractMetrics, generateClosingMessage } from '../services/conversation';
import { fetchWeatherForDate } from '../services/weather';
import { analyzePatterns } from '../services/patterns';

const router = Router();

// Get today's date in YYYY-MM-DD format
function today(): string {
  return new Date().toISOString().split('T')[0];
}

// Start or resume today's check-in
router.post('/start', async (req: Request, res: Response) => {
  const db = getDb();
  const date = req.body.date || today();

  // Check if a check-in already exists for this date
  let checkin = db.prepare('SELECT * FROM checkins WHERE date = ?').get(date) as any;

  if (checkin && checkin.completed_at) {
    return res.json({
      status: 'already_completed',
      checkin_id: checkin.id,
      message: "You've already checked in today! Come back tomorrow, or view your dashboard for insights.",
    });
  }

  if (!checkin) {
    const result = db.prepare('INSERT INTO checkins (date) VALUES (?)').run(date);
    checkin = { id: result.lastInsertRowid, date };
  }

  // Fetch weather in background
  fetchWeatherForDate(date).catch(() => {});

  // Get already-answered question IDs
  const answered = db.prepare('SELECT DISTINCT question AS id FROM responses WHERE checkin_id = ?')
    .all(checkin.id) as Array<{ id: string }>;
  const answeredIds = answered.map(a => a.id);

  // Check cycle tracking setting
  const cycleTracking = (db.prepare("SELECT value FROM settings WHERE key = 'cycle_tracking'").get() as any)?.value === 'true';

  const nextQuestion = getNextQuestion(answeredIds, cycleTracking);

  // Get user's name for greeting
  const name = (db.prepare("SELECT value FROM settings WHERE key = 'name'").get() as any)?.value || '';

  res.json({
    status: 'in_progress',
    checkin_id: checkin.id,
    date,
    name,
    answered_count: answeredIds.length,
    total_questions: getQuestionFlow(cycleTracking).length,
    next_question: nextQuestion,
  });
});

// Submit an answer and get the next question
router.post('/answer', async (req: Request, res: Response) => {
  const db = getDb();
  const { checkin_id, question_id, category, answer } = req.body;

  if (!checkin_id || !question_id || !answer) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Determine numeric value for scale/number types
  const numericValue = !isNaN(parseFloat(answer)) ? parseFloat(answer) : null;

  // Save response
  db.prepare(`
    INSERT INTO responses (checkin_id, category, question, answer, numeric_value)
    VALUES (?, ?, ?, ?, ?)
  `).run(checkin_id, category || 'general', question_id, answer, numericValue);

  // Get already-answered question IDs
  const answered = db.prepare('SELECT DISTINCT question AS id FROM responses WHERE checkin_id = ?')
    .all(checkin_id) as Array<{ id: string }>;
  const answeredIds = answered.map(a => a.id);

  const cycleTracking = (db.prepare("SELECT value FROM settings WHERE key = 'cycle_tracking'").get() as any)?.value === 'true';
  const nextQuestion = getNextQuestion(answeredIds, cycleTracking);
  const totalQuestions = getQuestionFlow(cycleTracking).length;

  if (!nextQuestion) {
    // Check-in is complete
    const date = (db.prepare('SELECT date FROM checkins WHERE id = ?').get(checkin_id) as any)?.date || today();

    // Fetch weather
    const weather = await fetchWeatherForDate(date);

    // Get all responses for metrics extraction
    const allResponses = db.prepare('SELECT question as id, category, answer FROM responses WHERE checkin_id = ?')
      .all(checkin_id) as Array<{ id: string; category: string; answer: string }>;

    // Extract and store metrics
    const metrics = extractMetrics(allResponses);
    const insertMetric = db.prepare(`
      INSERT INTO daily_metrics (checkin_id, date, category, metric_name, numeric_value, text_value)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const m of metrics) {
      insertMetric.run(checkin_id, date, m.category, m.metric_name, m.numeric_value, m.text_value);
    }

    // Mark complete
    const closingMessage = generateClosingMessage(allResponses, weather);
    db.prepare('UPDATE checkins SET completed_at = datetime("now"), summary = ? WHERE id = ?')
      .run(closingMessage, checkin_id);

    // Run pattern analysis (non-critical — don't fail the check-in if this errors)
    let insights: ReturnType<typeof analyzePatterns> = [];
    try {
      insights = analyzePatterns();
    } catch (err) {
      console.error('Pattern analysis failed:', err);
    }

    return res.json({
      status: 'completed',
      message: closingMessage,
      weather,
      new_insights: insights.slice(0, 3),
    });
  }

  res.json({
    status: 'in_progress',
    answered_count: answeredIds.length,
    total_questions: totalQuestions,
    next_question: nextQuestion,
  });
});

// Get check-in history
router.get('/history', (req: Request, res: Response) => {
  const db = getDb();
  const limit = parseInt(req.query.limit as string) || 30;
  const checkins = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM responses WHERE checkin_id = c.id) as response_count
    FROM checkins c
    ORDER BY c.date DESC
    LIMIT ?
  `).all(limit);
  res.json(checkins);
});

// Get a specific check-in with all responses
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = req.params.id as string;
  const checkin = db.prepare('SELECT * FROM checkins WHERE id = ?').get(id);
  if (!checkin) return res.status(404).json({ error: 'Not found' });

  const responses = db.prepare('SELECT * FROM responses WHERE checkin_id = ? ORDER BY created_at').all(id);
  const metrics = db.prepare('SELECT * FROM daily_metrics WHERE checkin_id = ?').all(id);
  const weather = db.prepare('SELECT * FROM weather WHERE date = ?').get((checkin as any).date);

  res.json({ ...checkin as any, responses, metrics, weather });
});

export default router;
