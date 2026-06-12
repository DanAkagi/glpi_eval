import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const router = Router();

// ── SQLite setup ─────────────────────────────────────────
const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'kanban.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

// One row per column, identified by `col_id` (new / in_progress / closed)
db.exec(`
  CREATE TABLE IF NOT EXISTS kanban_columns (
    col_id   TEXT PRIMARY KEY,
    label    TEXT NOT NULL,
    label_mg TEXT NOT NULL,
    color    TEXT NOT NULL
  )
`);

const DEFAULT_COLUMNS = [
  { id: 'new',         label: 'New',         labelMg: 'Vaovao',    color: '#e3f2fd' },
  { id: 'in_progress', label: 'In Progress', labelMg: 'Efa manao', color: '#fff8e1' },
  { id: 'closed',      label: 'Closed',      labelMg: 'Vita',      color: '#e8f5e9' },
];

// Seed defaults on first run (if table is empty)
const countRow = db.prepare('SELECT COUNT(*) AS c FROM kanban_columns').get() as { c: number };
if (countRow.c === 0) {
  const insert = db.prepare(`
    INSERT INTO kanban_columns (col_id, label, label_mg, color)
    VALUES (@id, @label, @labelMg, @color)
  `);
  const insertAll = db.transaction((cols: typeof DEFAULT_COLUMNS) => {
    for (const col of cols) insert.run(col);
  });
  insertAll(DEFAULT_COLUMNS);
}

// ── Helpers ──────────────────────────────────────────────
function readColumns() {
  const rows = db.prepare('SELECT col_id, label, label_mg, color FROM kanban_columns').all() as any[];
  // Preserve a stable order matching DEFAULT_COLUMNS (new, in_progress, closed)
  const order = DEFAULT_COLUMNS.map(c => c.id);
  return order
    .map(id => rows.find(r => r.col_id === id))
    .filter(Boolean)
    .map(r => ({ id: r.col_id, label: r.label, labelMg: r.label_mg, color: r.color }));
}

const upsertStmt = db.prepare(`
  INSERT INTO kanban_columns (col_id, label, label_mg, color)
  VALUES (@id, @label, @labelMg, @color)
  ON CONFLICT(col_id) DO UPDATE SET
    label    = excluded.label,
    label_mg = excluded.label_mg,
    color    = excluded.color
`);

// ── Routes ───────────────────────────────────────────────

// GET /api/kanban/config
router.get('/config', (_req: Request, res: Response) => {
  try {
    res.json({ columns: readColumns() });
  } catch (e: any) {
    console.error('[Kanban] Failed to read config:', e?.message);
    res.status(500).json({ error: 'Failed to read kanban config' });
  }
});

// PUT /api/kanban/config — update full config
router.put('/config', (req: Request, res: Response) => {
  try {
    const { columns } = req.body;
    if (!Array.isArray(columns) || columns.length !== 3) {
      return res.status(400).json({ error: 'Expected exactly 3 columns' });
    }

    for (const col of columns) {
      if (!col.id || !col.label || !col.labelMg || !col.color) {
        return res.status(400).json({ error: 'Each column requires id, label, labelMg, color' });
      }
    }

    const updateAll = db.transaction((cols: typeof columns) => {
      for (const col of cols) upsertStmt.run(col);
    });
    updateAll(columns);

    res.json({ success: true, columns: readColumns() });
  } catch (e: any) {
    console.error('[Kanban] Failed to save config:', e?.message);
    res.status(500).json({ error: 'Failed to save kanban config' });
  }
});

export default router;
