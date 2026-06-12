import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { glpiApiService } from '../services/glpiApi';

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

db.exec(`
  CREATE TABLE IF NOT EXISTS super_costs (
    ticket_id INTEGER PRIMARY KEY,
    amount  REAL NOT NULL
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

const upsertSuperCostStmt = db.prepare(`
  INSERT INTO super_costs (ticket_id, amount)
  VALUES (@ticket_id, @amount) 
  ON CONFLICT (ticket_id) DO UPDATE SET amount = excluded.amount
`)

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

router.post('/super-costs', (req: Request, res: Response) => {
  try {
    const { ticket_id, amount } = req.body;
    upsertSuperCostStmt.run({ ticket_id, amount });
    console.log("Insert/update super cost done");
    res.json({ success: true });
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Insert failed' });
  }
});

router.get('/costs-by-asset-type', async (_req: Request, res: Response) => {
  try {
    // 1. All Item_Ticket links (once)
    let allLinks: any[] = [];
    try {
      const links = await glpiApiService.getLegacy('/Item_Ticket', { range: '0-9999' });
      allLinks = Array.isArray(links) ? links : [];
    } catch (e: any) {
      console.warn('[Kanban] Failed to fetch Item_Ticket links:', e?.response?.data || e?.message);
    }

    // 2. All tickets
    const tickets = await glpiApiService.get('/Assistance/Ticket', { limit: 10000 });
    const ticketIds: number[] = (tickets || []).map((t: any) => t.id);

    // 3. Super costs from SQLite, keyed by ticket_id
    const superCostRows = db.prepare('SELECT ticket_id, amount FROM super_costs').all() as
      { ticket_id: number; amount: number }[];
    const superCostByTicket = new Map<number, number>();
    for (const r of superCostRows) {
      superCostByTicket.set(r.ticket_id, (superCostByTicket.get(r.ticket_id) || 0) + r.amount);
    }

    // 4. GLPI native costs per ticket (sum cost_fixed + cost_time + cost_material)
    const glpiCostByTicket = new Map<number, number>();
    for (const ticketId of ticketIds) {
      const hasLinks = allLinks.some((l: any) => Number(l.tickets_id) === ticketId);
      const hasSuperCost = superCostByTicket.has(ticketId);
      if (!hasLinks && !hasSuperCost) continue;

      try {
        const costs = await glpiApiService.get(`/Assistance/Ticket/${ticketId}/Cost`);
        const sum = (costs || []).reduce((acc: number, c: any) =>
          acc + (Number(c.cost_fixed) || 0) + (Number(c.cost_time) || 0) + (Number(c.cost_material) || 0), 0);
        if (sum > 0) glpiCostByTicket.set(ticketId, sum);
      } catch { /* ignore */ }
    }

    // 5. Aggregate per itemtype
    const byType: Record<string, { costs: number; super_costs: number }> = {};
    let unassigned = 0;

    const allTicketIds = new Set<number>([...glpiCostByTicket.keys(), ...superCostByTicket.keys()]);

    for (const ticketId of allTicketIds) {
      const glpiCost  = glpiCostByTicket.get(ticketId)  || 0;
      const superCost = superCostByTicket.get(ticketId) || 0;
      if (glpiCost === 0 && superCost === 0) continue;

      const links = allLinks.filter((l: any) => Number(l.tickets_id) === ticketId && l.itemtype);

      if (links.length === 0) {
        unassigned += glpiCost + superCost;
        continue;
      }

      const glpiShare  = glpiCost  / links.length;
      const superShare = superCost / links.length;

      for (const link of links) {
        if (!byType[link.itemtype]) byType[link.itemtype] = { costs: 0, super_costs: 0 };
        byType[link.itemtype].costs       += glpiShare;
        byType[link.itemtype].super_costs += superShare;
      }
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;

    const types = Object.entries(byType)
      .map(([itemtype, v]) => ({
        itemtype,
        costs:       round2(v.costs),
        super_costs: round2(v.super_costs),
        total:       round2(v.costs + v.super_costs),
      }))
      .sort((a, b) => b.total - a.total);

    const total = round2(types.reduce((acc, t) => acc + t.total, 0) + unassigned);

    res.json({ types, total, unassigned: round2(unassigned) });
  } catch (e: any) {
    console.error('[Kanban] Failed to aggregate costs:', e?.message);
    res.status(500).json({ error: 'Failed to aggregate costs' });
  }
});
 
export default router;
