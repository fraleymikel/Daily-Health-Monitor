import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', '..', 'health.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeDatabase(db);
  }
  return db;
}

function initializeDatabase(db: Database.Database) {
  db.exec(`
    -- Daily check-in sessions
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      summary TEXT
    );

    -- Individual responses within a check-in
    CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkin_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      numeric_value REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (checkin_id) REFERENCES checkins(id)
    );

    -- Weather data for each day
    CREATE TABLE IF NOT EXISTS weather (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      temperature_high REAL,
      temperature_low REAL,
      humidity REAL,
      precipitation REAL,
      weather_code INTEGER,
      weather_description TEXT,
      uv_index REAL,
      pressure REAL,
      raw_json TEXT
    );

    -- Tracked variables / metrics extracted from responses
    CREATE TABLE IF NOT EXISTS daily_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkin_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      numeric_value REAL,
      text_value TEXT,
      FOREIGN KEY (checkin_id) REFERENCES checkins(id)
    );

    -- Pattern insights discovered by the analysis engine
    CREATE TABLE IF NOT EXISTS insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
      pattern_type TEXT NOT NULL,
      description TEXT NOT NULL,
      suggestion TEXT,
      variables TEXT NOT NULL,
      correlation_strength REAL,
      data_points INTEGER,
      dismissed INTEGER NOT NULL DEFAULT 0
    );

    -- User settings
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_responses_checkin ON responses(checkin_id);
    CREATE INDEX IF NOT EXISTS idx_responses_category ON responses(category);
    CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date);
    CREATE INDEX IF NOT EXISTS idx_daily_metrics_category ON daily_metrics(category);
    CREATE INDEX IF NOT EXISTS idx_weather_date ON weather(date);
  `);

  // Seed default settings if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number };
  if (count.c === 0) {
    const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    insert.run('latitude', '40.7128');
    insert.run('longitude', '-74.0060');
    insert.run('timezone', 'America/New_York');
    insert.run('name', '');
    insert.run('cycle_tracking', 'false');
    insert.run('cycle_length', '28');
  }
}
