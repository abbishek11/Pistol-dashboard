CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  session_date TEXT NOT NULL,
  session_number INTEGER,
  discipline TEXT,
  distance TEXT,
  total_shots INTEGER,
  total_score INTEGER,
  max_score INTEGER,
  x_count INTEGER,
  series JSONB DEFAULT '[]',
  shot_breakdown JSONB,
  notes JSONB DEFAULT '{}',
  photo_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
