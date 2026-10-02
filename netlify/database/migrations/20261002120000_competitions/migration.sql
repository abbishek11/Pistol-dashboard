CREATE TABLE IF NOT EXISTS competitions (
  id SERIAL PRIMARY KEY,
  comp_date TEXT NOT NULL,
  comp_name TEXT,              -- e.g. "State Championship 2026"
  lane TEXT,                   -- e.g. "10M-2"
  comp_no TEXT,                -- competitor number, e.g. "0260"
  athlete_name TEXT,
  event_no TEXT,               -- e.g. "ARI06, ARI08"
  dra_rc_ru TEXT,              -- club / category column, e.g. "KRR AIR RIFLE"
  series JSONB DEFAULT '[]',   -- up to 6 series scores, in order
  penalty NUMERIC(6,1) DEFAULT 0,
  total NUMERIC(8,1) DEFAULT 0,
  remarks TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitions_date ON competitions(comp_date);
