import { Router } from 'express';
import { glpiApiService, ASSET_ITEM_TYPES } from '../services/glpiApi.js';

const router = Router();

router.post('/', async (req, res) => {
  const results: Record<string, number> = {};
  const errors: string[] = [];

  try {
    // 1. Get available itemtypes from GLPI, fall back to full list
    const itemTypes = await glpiApiService.getAssetItemTypes();

    // 2. Delete all assets for each itemtype (force=true → permanent)
    for (const itemType of itemTypes) {
      try {
        const items = await glpiApiService.get(`/Assets/${itemType}`, { limit: 10000 });
        let deleted = 0;
        for (const item of (items || [])) {
          try {
            await glpiApiService.delete(`/Assets/${itemType}/${item.id}`, true);
            deleted++;
          } catch (e: any) {
            errors.push(`Delete ${itemType}#${item.id}: ${e?.message}`);
          }
        }
        if (deleted > 0) results[itemType] = deleted;
      } catch (e: any) {
        // itemtype may not exist on this GLPI instance, skip silently
      }
    }

    // 3. Delete all tickets (force=true → permanent, costs cascade)
    try {
      const tickets = await glpiApiService.get('/Assistance/Ticket', { limit: 10000 });
      let deletedTickets = 0;
      for (const ticket of (tickets || [])) {
        try {
          await glpiApiService.delete(`/Assistance/Ticket/${ticket.id}`, true);
          deletedTickets++;
        } catch (e: any) {
          errors.push(`Delete Ticket#${ticket.id}: ${e?.message}`);
        }
      }
      results['Ticket'] = deletedTickets;
    } catch (e: any) {
      errors.push(`Fetch tickets: ${e?.message}`);
    }

    res.json({
      success: true,
      message: 'Reset completed (permanent delete)',
      deleted: results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('Reset failed:', error);
    res.status(500).json({ error: 'Failed to reset data', detail: error?.message });
  }
});

export default router;