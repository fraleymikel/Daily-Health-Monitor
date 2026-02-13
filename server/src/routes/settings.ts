import { Router, Request, Response } from 'express';
import { getDb } from '../models/database';

const router = Router();

// Get all settings
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  res.json(settings);
});

// Update settings
router.put('/', (req: Request, res: Response) => {
  const db = getDb();
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

  const validKeys = ['latitude', 'longitude', 'timezone', 'name', 'cycle_tracking', 'cycle_length'];

  for (const [key, value] of Object.entries(req.body)) {
    if (validKeys.includes(key) && typeof value === 'string') {
      upsert.run(key, value);
    }
  }

  res.json({ success: true });
});

export default router;
