CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  attend_date TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  spend_date TEXT NOT NULL,
  category TEXT NOT NULL,      -- 'class_fee' | 'accessory' | 'pellets' | 'cylinder_refill' | 'sheets'
  item_name TEXT,              -- free text, e.g. "grip tape", "shooting glasses"
  amount NUMERIC(10,2) NOT NULL,
  quantity INTEGER,            -- pellet boxes, sheet count, refill count
  purchase_source TEXT,        -- 'online' | 'physical' | NULL
  vendor TEXT,                 -- free text, optional
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(spend_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attend_date);
