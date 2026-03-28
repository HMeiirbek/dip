CREATE TABLE IF NOT EXISTS ml_models_runtime (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  accuracy DOUBLE PRECISION NOT NULL,
  precision DOUBLE PRECISION NOT NULL,
  recall DOUBLE PRECISION NOT NULL,
  f1 DOUBLE PRECISION NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_models_runtime_active_loaded
  ON ml_models_runtime(is_active, loaded_at DESC);
