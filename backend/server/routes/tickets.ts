import { Router, Request, Response } from 'express';
import { glpiApiService, ASSET_ITEM_TYPES, CSV_TYPE_TO_GLPI, AssetItemType } from '../services/glpiApi.js';

const router = Router();

// GLPI status id → human label
const TICKET_STATUS: Record<number, string> = {
  1: 'New', 10: 'Validation', 2: 'Assigned',
  3: 'Planned', 4: 'In progress', 5: 'Solved', 6: 'Closed'
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
    'Planned': 3, 'In progresss': 4, 'Waiting': 4, 'Pending': 4, 'Solved': 5, 'Closed': 6
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

    // Fetch linked assets via High-Level API (items field)
    if (response._item_names) {
      ticket.items = response._item_names;
    }

    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get ticket' });
  }
});

// POST /tickets  — create a new ticket with dynamic asset resolution
router.post('/', async (req: Request, res: Response) => {
  try {
    const { titre, description, type, priority, date, items } = req.body;

    if (!titre) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const dateValue = date || new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Structure de base du ticket pour GLPI
    const ticketData: Record<string, any> = {
      name:     titre       || '',
      content:  description || '',
      type:     typeToInt(type),
      status:   { id: 1 }, // Statut: New
      priority: priorityToInt(priority || 'Medium'),
      date:     dateValue,
    };

    // ── BLOC DE RÉSOLUTION DES ASSETS ────────────────────────────────────────
    if (Array.isArray(items) && items.length > 0) {
      const resolvedGlpiItems: { itemtype: string; items_id: number }[] = [];
      
      // 1. Récupérer tous les types d'assets configurés dans votre GLPI
      const assetTypes = await glpiApiService.getAssetItemTypes();

      // 2. Pour chaque critère de recherche envoyé par le frontend
      for (const itemSearchKey of items) {
        if (!itemSearchKey || typeof itemSearchKey !== 'string') continue;

        let assetFound = false;

        // 3. Parcourir les types d'assets (comme dans assets.ts) pour trouver une correspondance
        for (const itemType of assetTypes) {
          try {
            // Recherche par nom ou numéro d'inventaire (otherserial) via l'API GLPI
            // Vous pouvez ajuster les filtres selon ce que le frontend envoie (ex: ?searchText[name]=...)
            const searchResponse = await glpiApiService.get(`/Assets/${itemType}`, {
              'searchText[name]': itemSearchKey.trim()
            });

            // Si GLPI retourne un résultat valide
            if (Array.isArray(searchResponse) && searchResponse.length > 0) {
              const matchedAsset = searchResponse[0]; // On prend le premier élément qui matche
              
              resolvedGlpiItems.push({
                itemtype: itemType,      // ex: "Computer"
                items_id: matchedAsset.id // ex: 123
              });
              
              console.log(`[Ticket Service] Asset résolu : "${itemSearchKey}" ➔ ${itemType} ID #${matchedAsset.id}`);
              assetFound = true;
              break; // Arrêter de chercher dans les autres types pour cet item
            }
          } catch (err) {
            // On ignore silencieusement les types d'assets non configurés ou vides
          }
        }

        if (!assetFound) {
          console.warn(`[Ticket Service] Impossible de trouver l'asset correspondant à : "${itemSearchKey}"`);
        }
      }

      // 4. Assigner les items résolus au payload du ticket si on en a trouvé
      if (resolvedGlpiItems.length > 0) {
        ticketData.items = resolvedGlpiItems;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Envoi du payload normalisé et lié à GLPI
    const response = await glpiApiService.post('/Assistance/Ticket', ticketData);
    const ticketId: number = response.id;

    res.json({
      success: true,
      id:      ticketId,
      ticket:  normalizeTicket(response),
    });
  } catch (error: any) {
    console.error('Create ticket failed:', error?.response?.data || error?.message);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// PATCH /tickets/:id  — update ticket
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { status, priority, type, ...rest } = req.body;

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