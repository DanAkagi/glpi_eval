import { Router, Request, Response } from 'express';
import { glpiApiService, ASSET_ITEM_TYPES, CSV_TYPE_TO_GLPI, AssetItemType } from '../services/glpiApi';

const router = Router();

// Normalise a raw GLPI asset into a flat object for the frontend
function normalizeAsset(item: any, itemType: string) {
  return {
    id:               item.id,
    name:             item.name || '',
    status:           item.status?.name  || '',
    location:         item.locations_id?.name || item.location?.name || '',
    manufacturer:     item.manufacturers_id?.name || item.manufacturer?.name || '',
    item_type:        itemType,
    model:            item.models_id?.name || item.model?.name || '',
    inventory_number: item.otherserial  || '',
    user:             item.users_id?.name || item.user?.name || '',
  };
}

// GET /assets  — fetch from all itemtypes, apply optional filters
router.get('/', async (req: Request, res: Response) => {
  const { name, status, location, item_type, user } = req.query;

  // If item_type filter is set, only query that type; otherwise query all
  const typesToQuery: AssetItemType[] = item_type
    ? [CSV_TYPE_TO_GLPI[item_type as string] || (item_type as AssetItemType)]
    : await glpiApiService.getAssetItemTypes();

  const allAssets: any[] = [];

  for (const itemType of typesToQuery) {
    if (!(ASSET_ITEM_TYPES as readonly string[]).includes(itemType)) continue;
    try {
      const params: Record<string, any> = { limit: 10000 };
      if (name) params.filter = `name=ilike=${name}`;

      const response = await glpiApiService.get(`/Assets/${itemType}`, params);
      const normalized = (response || []).map((item: any) => normalizeAsset(item, itemType));
      allAssets.push(...normalized);
    } catch { /* itemtype not available, skip */ }
  }

  // In-memory filters for fields that RSQL doesn't easily handle
  let result = allAssets;
  if (status)   result = result.filter(a => a.status.toLowerCase().includes((status as string).toLowerCase()));
  if (location) result = result.filter(a => a.location.toLowerCase().includes((location as string).toLowerCase()));
  if (user)     result = result.filter(a => a.user.toLowerCase().includes((user as string).toLowerCase()));

  res.json(result);
});

// GET /assets/:itemtype/:id  — single asset by type and id
router.get('/:itemtype/:id', async (req: Request, res: Response) => {
  const { itemtype, id } = req.params;
  const itemTypeStr = Array.isArray(itemtype) ? itemtype[0] : itemtype;
  const glpiType: AssetItemType = CSV_TYPE_TO_GLPI[itemTypeStr] || (itemTypeStr as AssetItemType);

  if (!(ASSET_ITEM_TYPES as readonly string[]).includes(glpiType)) {
    return res.status(400).json({ error: `Unknown item type: ${itemtype}` });
  }

  try {
    const response = await glpiApiService.get(`/Assets/${glpiType}/${id}`);
    if (!response) return res.status(404).json({ error: 'Asset not found' });
    res.json(normalizeAsset(response, glpiType));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get asset' });
  }
});

// GET /assets/:id  — legacy route: search across all types
router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const types = await glpiApiService.getAssetItemTypes();
  for (const itemType of types) {
    try {
      const response = await glpiApiService.get(`/Assets/${itemType}/${id}`);
      if (response) return res.json(normalizeAsset(response, itemType));
    } catch { /* not found in this type, try next */ }
  }

  res.status(404).json({ error: 'Asset not found' });
});

export default router;