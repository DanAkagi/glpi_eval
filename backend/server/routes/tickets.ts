import { Router, Request, Response } from 'express';
import { glpiApiService } from '../services/glpiApi.js';

const router = Router();

// GLPI status id → human label
const TICKET_STATUS: Record<number, string> = {
  1: 'New', 10: 'Validation', 2: 'Assigned',
  3: 'Planned', 4: 'Waiting', 5: 'Solved', 6: 'Closed'
};

// GLPI type int → human label
const TICKET_TYPE: Record<number, string> = { 1: 'Incident', 2: 'Request' };

// GLPI priority int → human label
const TICKET_PRIORITY: Record<number, string> = {
  1: 'Very Low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Very High'
};

function normalizeTicket(item: any) {
  return {
    id:          item.id,
    ref_ticket:  item.external_id || item.id,  // Use external_id (CSV Ref) if available, otherwise GLPI id
    date:        item.date         || '',
    type:        TICKET_TYPE[item.type]           || item.type       || 'Incident',
    titre:       item.name         || '',
    description: item.content      || '',
    status:      TICKET_STATUS[item.status?.id]   || item.status?.name || 'New',
    priority:    TICKET_PRIORITY[item.priority]   || item.priority   || 'Medium',
    items:       item._item_names  || [],
    costs:       item.costs        || [],
  };
}

function normalizeCost(cost: any, ticketId: number) {
  return {
    id:              cost.id,
    num_ticket:      ticketId,
    name:            cost.name            || '',
    duration_second: cost.duration        || 0,
    time_cost:       cost.cost_time       || 0,
    fixed_cost:      cost.cost_fixed      || 0,
    material_cost:   cost.cost_material   || 0,
    date_begin:      cost.date_begin      || null,
    date_end:        cost.date_end        || null,
  };
}

// Map Priority string → int
function priorityToInt(p: string): number {
  const map: Record<string, number> = {
    'Very Low': 1, 'Low': 2, 'Medium': 3, 'High': 4, 'Very High': 5
  };
  return map[p] ?? parseInt(p) ?? 3;
}

// Map Type string → int
function typeToInt(t: string): number {
  if (!t) return 1;
  return t.toLowerCase() === 'request' || t === '2' ? 2 : 1;
}

// Map Status string → id object
function statusToObj(s: string): { id: number } {
  const map: Record<string, number> = {
    'New': 1, 'Validation': 10, 'Assigned': 2,
    'Planned': 3, 'Waiting': 4, 'Pending': 4, 'Solved': 5, 'Closed': 6
  };
  return { id: map[s] ?? parseInt(s) ?? 1 };
}

// GET /tickets
router.get('/', async (req: Request, res: Response) => {
  try {
    const response = await glpiApiService.get('/Assistance/Ticket', {
      sort: 'date',
      limit: 10000
    });
    res.json((response || []).map(normalizeTicket));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tickets' });
  }
});

// GET /tickets/:id  (with costs)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const response = await glpiApiService.get(`/Assistance/Ticket/${req.params.id}`);
    if (!response) return res.status(404).json({ error: 'Ticket not found' });

    const ticket = normalizeTicket(response);
    const ticketId = Number(req.params.id);

    try {
      const costsResponse = await glpiApiService.get(`/Assistance/Ticket/${ticketId}/Cost`);
      ticket.costs = (costsResponse || []).map((c: any) => normalizeCost(c, ticketId));
    } catch {
      ticket.costs = [];
    }

    // Fetch linked assets via Legacy API (Item_Ticket collection)
    try {
      const allLinks = await glpiApiService.getLegacy('/Item_Ticket', { range: '0-9999' });
      const links = (Array.isArray(allLinks) ? allLinks : [])
        .filter((l: any) => Number(l.tickets_id) === ticketId);

      const linkedItems: Array<{ id: number; itemtype: string; name?: string }> = [];
      for (const link of links) {
        const it = link.itemtype;
        const id = link.items_id;
        if (!it || !id) continue;
        try {
          const item = await glpiApiService.get(`/Assets/${it}/${id}`);
          linkedItems.push({ id, itemtype: it, name: item?.name });
        } catch {
          linkedItems.push({ id, itemtype: it });
        }
      }
      ticket.items = linkedItems;
    } catch (e: any) {
      console.error(`Failed to fetch linked items for ticket ${ticketId}:`, e?.response?.data || e?.message);
    }

    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get ticket' });
  }
});

function parseDateTime(dateStr: string, timeStr: string): string {
  if (!dateStr) return new Date().toISOString().slice(0, 19).replace('T', ' ');
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const time = timeStr?.trim() || '00:00';
    return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')} ${time}:00`;
  }
  return dateStr;
}

// POST /tickets  — create ticket + link assets via Legacy API
router.post('/', async (req: Request, res: Response) => {
  try {
    const { type, titre, description, priority, date, heure, items } = req.body;
    // items: Array<{ id: number; itemtype: string }> — passed from frontend

    const ticketData: Record<string, any> = {
      name:     titre       || '',
      content:  description || '',
      type:     typeToInt(type),
      status:   { id: 1 }, // New
      priority: priorityToInt(priority || 'Medium'),
      date:     parseDateTime(date, heure),
    };

    const response = await glpiApiService.post('/Assistance/Ticket', ticketData);
    const ticketId: number = response.id;

    // Link assets via Legacy API (High-Level API has no Item_Ticket endpoint)
    const linkedItems: Array<{ id: number; itemtype: string; name?: string; linked: boolean }> = [];
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const itemType = item.itemtype || item.item_type;
        if (!item.id || !itemType) continue;
        try {
          await glpiApiService.postLegacy('/Item_Ticket', {
            input: {
              tickets_id: ticketId,
              itemtype:   itemType,
              items_id:   item.id,
            }
          });
          linkedItems.push({ id: item.id, itemtype: itemType, name: item.name, linked: true });
        } catch (linkErr: any) {
          console.warn(`Link asset ${itemType}#${item.id} to ticket ${ticketId} failed:`, linkErr?.response?.data?.message || linkErr?.message);
          linkedItems.push({ id: item.id, itemtype: itemType, name: item.name, linked: false });
        }
      }
    }

    const normalized = normalizeTicket(response);
    normalized.items = linkedItems;

    res.json({
      success: true,
      id:      ticketId,
      ticket:  normalized,
      linked_items: linkedItems,
    });
  } catch (error: any) {
    console.error('Create ticket failed:', error?.response?.data || error?.message);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// PATCH /tickets/:id  — update ticket
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { status, super_cost, priority, type, ...rest } = req.body;

    const updateData: Record<string, any> = { ...rest };
    if (status)   updateData.status   = statusToObj(status);
    if (priority) updateData.priority = priorityToInt(priority);
    if (type)     updateData.type     = typeToInt(type);

    const response = await glpiApiService.patch(`/Assistance/Ticket/${req.params.id}`, updateData);
    res.json({ success: true, ticket: normalizeTicket(response) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

export default router;