import { Router, Request, Response } from 'express';
import { glpiApiService, ASSET_ITEM_TYPES } from '../services/glpiApi.js';

const router = Router();

const TICKET_STATUS: Record<number, string> = {
  1: 'New', 10: 'Validation', 2: 'Assigned',
  3: 'Planned', 4: 'In progress', 5: 'Solved', 6: 'Closed'
};
const TICKET_TYPE: Record<number, string> = { 1: 'Incident', 2: 'Request' };
const TICKET_PRIORITY: Record<number, string> = {
  1: 'Very Low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Very High'
};

function count<T>(arr: T[], key: (item: T) => string): { label: string; count: number }[] {
  const map = new Map<string, number>();
  arr.forEach(item => {
    const k = key(item);
    map.set(k, (map.get(k) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

router.get('/', async (req: Request, res: Response) => {
  try {
    // ── Assets: fetch all itemtypes in parallel ──────────────────────────────
    const itemTypes = await glpiApiService.getAssetItemTypes();

    const assetResults = await Promise.allSettled(
      itemTypes.map(async (itemType) => {
        const items = await glpiApiService.get(`/Assets/${itemType}`, { limit: 10000 });
        return { itemType, items: (items || []) as any[] };
      })
    );

    const assetsByType: { label: string; count: number }[] = [];
    const allAssets: any[] = [];

    for (const result of assetResults) {
      if (result.status === 'fulfilled' && result.value.items.length > 0) {
        assetsByType.push({ label: result.value.itemType, count: result.value.items.length });
        allAssets.push(...result.value.items.map(a => ({ ...a, _itemType: result.value.itemType })));
      }
    }

    const assetsByStatus = count(allAssets, a => a.status?.name || 'Unknown');

    // ── Tickets ──────────────────────────────────────────────────────────────
    const ticketsResponse = await glpiApiService.get('/Assistance/Ticket', { limit: 10000 });
    const tickets: any[] = ticketsResponse || [];

    const ticketsByType     = count(tickets, t => TICKET_TYPE[t.type]           || 'Unknown');
    const ticketsByStatus   = count(tickets, t => TICKET_STATUS[t.status?.id]   || 'Unknown');
    const ticketsByPriority = count(tickets, t => TICKET_PRIORITY[t.priority]   || 'Unknown');

    res.json({
      assets: {
        total:    allAssets.length,
        byType:   assetsByType,
        byStatus: assetsByStatus,
      },
      tickets: {
        total:      tickets.length,
        byType:     ticketsByType,
        byStatus:   ticketsByStatus,
        byPriority: ticketsByPriority,
      }
    });
  } catch (error) {
    console.error('Get stats failed:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

export default router;