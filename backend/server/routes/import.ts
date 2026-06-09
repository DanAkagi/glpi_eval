import { Router, Request, Response } from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import { glpiApiService, CSV_TYPE_TO_GLPI, AssetItemType } from '../services/glpiApi.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const IMAGES_DIR = path.resolve(process.cwd(), 'public', 'images');

// ── CSV Parser ────────────────────────────────────────────────────────────────

function parseCSV(buffer: Buffer): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    Readable.from(buffer)
      .pipe(csv())
      .on('data', (d) => results.push(d))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

// ── GLPI Entity Resolution (getOrCreate pattern) ──────────────────────────────
//
// GLPI relational fields (locations_id, manufacturers_id, etc.) require
// numeric IDs pointing to existing records. Passing a plain string is silently
// ignored.  For each entity type we:
//   1. Search for an existing record matching the name (case-insensitive).
//   2. If found  → return its id.
//   3. If not    → create it and return the new id.
//
// Results are cached in-memory per import run to avoid duplicate API calls.

const cache: Record<string, Record<string, number>> = {
  location: {},
  manufacturer: {},
  computermodel: {},
  monitormodel: {},
  peripheralmodel: {},
  phonemodel: {},
  printermodel: {},
  networkequipmentmodel: {},
  user: {},
};

async function resolveId(
  entityType: string,
  apiPath: string,
  name: string
): Promise<number | undefined> {
  if (!name?.trim()) return undefined;
  const key = name.trim().toLowerCase();

  if (cache[entityType]?.[key] !== undefined) {
    return cache[entityType][key];
  }

  // Search existing
  try {
    const results = await glpiApiService.get(apiPath, {
      filter: `name==${name.trim()}`,
      limit: 1,
    });
    if (Array.isArray(results) && results.length > 0) {
      const id = results[0].id as number;
      cache[entityType][key] = id;
      return id;
    }
  } catch { /* not found or endpoint error, try create */ }

  // Create — Location and other tree dropdowns require entity:{id:0}
  const isHierarchical = ['location'].includes(entityType);
  const createPayload: Record<string, any> = { name: name.trim() };
  if (isHierarchical) createPayload.entity = { id: 0 };

  try {
    const created = await glpiApiService.post(apiPath, createPayload);
    const id = created.id as number;
    if (!cache[entityType]) cache[entityType] = {};
    cache[entityType][key] = id;
    console.log(`[GLPI] Created ${entityType} "${name.trim()}" → ID ${id}`);
    return id;
  } catch (e: any) {
    console.warn(`[GLPI] Could not create ${entityType} "${name}": ${e?.response?.data?.title || e?.message}`);
    return undefined;
  }
}

// Per-itemtype model endpoint — all under /Dropdowns/ (not /Assets/)
function modelApiPath(itemType: AssetItemType): string {
  const map: Record<string, string> = {
    Computer:           '/Dropdowns/ComputerModel',
    Monitor:            '/Dropdowns/MonitorModel',
    Peripheral:         '/Dropdowns/PeripheralModel',
    Phone:              '/Dropdowns/PhoneModel',
    Printer:            '/Dropdowns/PrinterModel',
    NetworkEquipment:   '/Dropdowns/NetworkEquipmentModel',
    SoftwareLicense:    '/Dropdowns/ComputerModel', // no dedicated SoftwareModel in Dropdowns
    Appliance:          '/Dropdowns/ComputerModel',
    Unmanaged:          '/Dropdowns/ComputerModel',
    Certificate:        '/Dropdowns/ComputerModel',
  };
  return map[itemType] || '/Dropdowns/ComputerModel';
}

function modelCacheKey(itemType: AssetItemType): string {
  return (itemType.toLowerCase() + 'model') as string;
}

// Resolve user by full name (CSV format: "Firstname Lastname" or "Lastname Firstname")
// GLPI stores firstname and realname separately — we try multiple combinations.
async function resolveUserId(name: string): Promise<number | undefined> {
  if (!name?.trim()) return undefined;
  const key = name.trim().toLowerCase();
  if (cache.user[key] !== undefined) {
    return cache.user[key] === -1 ? undefined : cache.user[key];
  }

  const parts = name.trim().split(/\s+/);

  // Strategy 1: exact username match
  try {
    const r = await glpiApiService.get('/Administration/User', {
      filter: `username==${name.trim()}`, limit: 1,
    });
    if (Array.isArray(r) && r.length > 0) { cache.user[key] = r[0].id; return r[0].id; }
  } catch { /* continue */ }

  // Strategy 2: "Firstname Lastname" → firstname=X;realname=Y
  if (parts.length >= 2) {
    const [first, ...rest] = parts;
    const last = rest.join(' ');

    // Try Firstname Lastname
    try {
      const r = await glpiApiService.get('/Administration/User', {
        filter: `firstname=ilike=${first};realname=ilike=${last}`,
        limit: 1,
      });
      if (Array.isArray(r) && r.length > 0) { cache.user[key] = r[0].id; return r[0].id; }
    } catch { /* continue */ }

    // Try Lastname Firstname (reversed)
    try {
      const r = await glpiApiService.get('/Administration/User', {
        filter: `realname=ilike=${first};firstname=ilike=${last}`,
        limit: 1,
      });
      if (Array.isArray(r) && r.length > 0) { cache.user[key] = r[0].id; return r[0].id; }
    } catch { /* continue */ }
  }

  // Strategy 3: partial match on realname (last part of full name)
  if (parts.length > 0) {
    try {
      const lastName = parts[parts.length - 1];
      const r = await glpiApiService.get('/Administration/User', {
        filter: `realname=ilike=${lastName}`, limit: 1,
      });
      if (Array.isArray(r) && r.length > 0) { cache.user[key] = r[0].id; return r[0].id; }
    } catch { /* continue */ }
  }

  // Strategy 4: create user from full name
  console.warn(`[GLPI] User "${name}" not found — creating user from full name`);
  try {
    const nameParts = name.trim().split(/\s+/);
    // slug username: lowercase, no accents, joined with dot
    const slug = name.trim()
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '.');

    const newUser = await glpiApiService.post('/Administration/User', {
      username:  slug,
      realname:  nameParts.length > 1 ? nameParts.slice(1).join(' ') : name.trim(),
      firstname: nameParts[0],
      is_active: true,
      password:  'ChangeMe123!',
      password2: 'ChangeMe123!',
    });
    const id = newUser.id as number;
    cache.user[key] = id;
    console.log(`[GLPI] Created user "${name}" (${slug}) → ID ${id}`);
    return id;
  } catch (e: any) {
    console.warn(`[GLPI] Could not create user "${name}": ${e?.response?.data?.title || e?.message} — asset will have no user`);
    cache.user[key] = -1; // mark as unresolvable to avoid retrying
    return undefined;
  }
}

// ── Value Mappers ──────────────────────────────────────────────────────────────

// ── State ID resolution (cache) ───────────────────────────────────────────────
// GLPI State IDs are NOT fixed — they vary per installation.
// We resolve them dynamically via GET /Dropdowns/State?filter=name==X

async function resolveStateId(statusName: string): Promise<number | undefined> {
  if (!statusName?.trim()) return undefined;
  return resolveId('state', '/Dropdowns/State', statusName);
}

// CSV Status label aliases → canonical GLPI State names (as created on install)
const STATUS_ALIASES: Record<string, string> = {
  'En production':  'En production',
  'In production':  'En production',
  'En stock':       'En stock',
  'In stock':       'En stock',
  'En réparation':  'En réparation',
  'Under repair':   'En réparation',
  'En panne':       'En réparation',
  'Broken':         'En réparation',
  'Maintenance':    'En réparation',
  'Hors service':   'Hors service',
  'Out of service': 'Hors service',
  'Volé':           'Volé',
  'Stolen':         'Volé',
  'Perdu':          'Perdu',
  'Lost':           'Perdu',
};

function mapPriority(priority: string): number {
  const map: Record<string, number> = {
    'Very Low': 1, 'Low': 2, 'Medium': 3, 'High': 4, 'Very High': 5,
    'Très basse': 1, 'Basse': 2, 'Moyenne': 3, 'Haute': 4, 'Très haute': 5,
  };
  return map[priority?.trim()] ?? 3;
}

function mapTicketType(type: string): number {
  if (!type) return 1;
  const t = type.trim().toLowerCase();
  return (t === 'request' || t === 'demande') ? 2 : 1;
}

function mapTicketStatus(status: string): number {
  const map: Record<string, number> = {
    'New': 1, 'Nouveau': 1,
    'Assigned': 2, 'Attribué': 2,
    'Planned': 3, 'Planifié': 3,
    'Waiting': 4, 'En attente': 4,
    'Pending': 4,  // Map Pending to Waiting (status 4)
    'Solved': 5, 'Résolu': 5,
    'Closed': 6, 'Clos': 6,
  };
  return map[status?.trim()] ?? 1;
}

function parseCsvDateTime(dateStr: string, timeStr: string): string {
  if (!dateStr) return new Date().toISOString().slice(0, 19).replace('T', ' ');
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const time = timeStr?.trim() || '00:00';
    return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')} ${time}:00`;
  }
  return dateStr;
}

// ── Asset Payload Builder (async: resolves all IDs) ───────────────────────────

async function buildAssetPayload(record: any, itemType: AssetItemType): Promise<Record<string, any>> {
  const payload: Record<string, any> = {
    name:        record.Name?.trim() || '',
    entity:      { id: 0 },
    otherserial: record.Inventory_Number?.trim() || '',
  };

  // status — resolve dynamic State ID via /Dropdowns/State, NOT a hardcoded integer
  // GLPI State IDs vary per installation; we must resolve by name.
  const canonicalStatus = STATUS_ALIASES[record.Status?.trim()] || record.Status?.trim();
  const stateId = canonicalStatus ? await resolveStateId(canonicalStatus) : undefined;
  if (stateId !== undefined) payload.status = { id: stateId };

  // Relational fields — High-Level API uses nested objects {id}, NOT _id integer fields
  const locationId = await resolveId('location', '/Dropdowns/Location', record.Location);
  if (locationId !== undefined) payload.location = { id: locationId };

  const manufacturerId = await resolveId('manufacturer', '/Dropdowns/Manufacturer', record.Manufacturer);
  if (manufacturerId !== undefined) payload.manufacturer = { id: manufacturerId };

  const modelId = await resolveId(modelCacheKey(itemType), modelApiPath(itemType), record.Model);
  if (modelId !== undefined) payload.model = { id: modelId };

  const userId = await resolveUserId(record.User);
  if (userId !== undefined) payload.user = { id: userId };

  return payload;
}

// ── Ticket Payload Builder ─────────────────────────────────────────────────────

function buildTicketPayload(record: any): Record<string, any> {
  const payload: Record<string, any> = {
    name:        record.Titre?.trim() || record.Title?.trim() || '',
    content:     record.Description?.trim() || '',
    type:        mapTicketType(record.Type),
    status:      mapTicketStatus(record.Status || 'New'),
    priority:    mapPriority(record.Priority || 'Medium'),
    date:        parseCsvDateTime(record.Date, record.Heure),
    // Store CSV Ref_Ticket in external_id for traceability (GLPI auto-assigns its own id)
    external_id: record.Ref_Ticket ? String(record.Ref_Ticket).trim() : undefined,
  };

  // Remove undefined
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  // _item_names stored separately — used for asset linking after ticket creation
  if (record.Items) {
    try {
      const items: string[] = JSON.parse(record.Items);
      if (Array.isArray(items) && items.length > 0) payload._item_names = items;
    } catch { /* malformed JSON */ }
  }

  return payload;
}

// ── Cost Payload Builder ───────────────────────────────────────────────────────
// The ticket id goes in the URL, NOT the body.

function buildCostPayload(record: any, csvRef: string): Record<string, any> {
  return {
    name:          `Cost - Ticket ${csvRef}`,
    duration:      parseInt(record.Duration_second) || 0,
    cost_time:     parseFloat((record.Time_Cost  || '0').replace(',', '.')) || 0,
    cost_fixed:    parseFloat((record.Fixed_Cost || '0').replace(',', '.')) || 0,
    cost_material: 0,
  };
}

// ── Image helper ──────────────────────────────────────────────────────────────

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
            '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp' })[ext] || 'image/jpeg';
}

// ── Individual routes ─────────────────────────────────────────────────────────

router.post('/assets', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const records = await parseCSV(req.file.buffer);
  let ok = 0;
  const errors: string[] = [];

  for (const record of records) {
    const itemType: AssetItemType = CSV_TYPE_TO_GLPI[record.Item_Type || ''] || 'Computer';
    try {
      const payload = await buildAssetPayload(record, itemType);
      await glpiApiService.post(`/Assets/${itemType}`, payload);
      ok++;
    } catch (e: any) {
      errors.push(`${record.Name} (${itemType}): ${e?.response?.data?.title || e?.message}`);
    }
  }

  res.json({ success: true, imported: ok, errors: errors.length, errorDetails: errors });
});

router.post('/tickets', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const records = await parseCSV(req.file.buffer);
  let ok = 0;
  const errors: string[] = [];

  for (const record of records) {
    try {
      const payload = buildTicketPayload(record);
      delete payload._item_names; // not a GLPI field
      await glpiApiService.post('/Assistance/Ticket', payload);
      ok++;
    } catch (e: any) {
      errors.push(`${record.Titre}: ${e?.response?.data?.title || e?.message}`);
    }
  }

  res.json({ success: true, imported: ok, errors: errors.length, errorDetails: errors });
});

router.post('/costs', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const records = await parseCSV(req.file.buffer);
  let ok = 0;
  const errors: string[] = [];

  for (const record of records) {
    const csvRef  = record.Num_Ticket?.trim();
    const glpiId  = parseInt(csvRef); // standalone import: csvRef IS the GLPI id
    if (!glpiId) { errors.push(`Invalid Num_Ticket: ${csvRef}`); continue; }

    try {
      const payload = buildCostPayload(record, csvRef);
      // Cost URI: /Assistance/Ticket/:ticket_glpi_id/Cost  — id in URL, NOT body
      await glpiApiService.post(`/Assistance/Ticket/${glpiId}/Cost`, payload);
      ok++;
    } catch (e: any) {
      errors.push(`Ticket ${glpiId}: ${e?.response?.data?.title || e?.message}`);
    }
  }

  res.json({ success: true, imported: ok, errors: errors.length, errorDetails: errors });
});

router.post('/images', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const zip     = new AdmZip(req.file.buffer);
    let extracted = 0;

    fs.mkdirSync(IMAGES_DIR, { recursive: true });

    for (const entry of zip.getEntries()) {
      if (entry.isDirectory || !entry.entryName.startsWith('images/')) continue;
      const dest = path.join(IMAGES_DIR, path.basename(entry.entryName));
      fs.writeFileSync(dest, entry.getData());
      extracted++;
    }

    res.json({ success: true, extracted, directory: IMAGES_DIR });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to extract images', detail: e?.message });
  }
});

// ── /import/all — Transactional with rollback ──────────────────────────────────

router.post('/all', upload.fields([
  { name: 'assets',  maxCount: 1 },
  { name: 'tickets', maxCount: 1 },
  { name: 'costs',   maxCount: 1 },
  { name: 'images',  maxCount: 1 },
]), async (req: Request, res: Response) => {
  const files = req.files as { [k: string]: Express.Multer.File[] };

  if (!files.assets || !files.tickets || !files.costs || !files.images) {
    return res.status(400).json({ error: 'All 4 files are required (assets, tickets, costs, images)' });
  }

  // Rollback tracking
  const createdAssets:  Array<{ id: number; itemType: string }> = [];
  const createdTickets: number[] = [];
  const createdCosts:   Array<{ ticketId: number; costId: number }> = [];
  const createdDocIds:  number[] = []; // GLPI Document IDs for rollback

  // Map CSV Ref_Ticket (string) → GLPI ticket ID (number)
  const csvRefToGlpiId: Record<string, number> = {};

  const rollback = async () => {
    console.log('[ROLLBACK] Starting...');
    for (const { ticketId, costId } of createdCosts) {
      try { await glpiApiService.delete(`/Assistance/Ticket/${ticketId}/Cost/${costId}`, true); } catch {}
    }
    for (const id of createdTickets) {
      try { await glpiApiService.delete(`/Assistance/Ticket/${id}`, true); } catch {}
    }
    for (const { id, itemType } of createdAssets) {
      try { await glpiApiService.delete(`/Assets/${itemType}/${id}`, true); } catch {}
    }
    for (const docId of createdDocIds) {
      try { await glpiApiService.delete(`/Management/Document/${docId}`, true); } catch {}
    }
    console.log('[ROLLBACK] Done.');
  };

  try {
    // Reset per-run cache
    Object.keys(cache).forEach(k => { cache[k] = {}; });

    // ── 1. Assets ──────────────────────────────────────────────────────────
    console.log('[IMPORT ALL] Processing assets...');
    const assetRecords = await parseCSV(files.assets[0].buffer);
    console.log(`[IMPORT ALL] Parsed ${assetRecords.length} asset records`);

    for (const record of assetRecords) {
      const itemType: AssetItemType = CSV_TYPE_TO_GLPI[record.Item_Type || ''] || 'Computer';
      console.log(`[IMPORT ALL] Processing asset: ${record.Name} (Type: ${record.Item_Type} -> ${itemType})`);
      console.log(`[IMPORT ALL] Asset record data:`, record);

      const payload = await buildAssetPayload(record, itemType);
      console.log(`[IMPORT ALL] Asset payload for ${record.Name}:`, payload);

      const response = await glpiApiService.post(`/Assets/${itemType}`, payload);
      createdAssets.push({ id: response.id, itemType });
      console.log(`[IMPORT ALL] Successfully created asset ${record.Name} with GLPI ID: ${response.id}`);
    }
    console.log(`[IMPORT ALL] Assets import complete: ${createdAssets.length} created`);

    // ── 2. Tickets + asset linking via Legacy API ──────────────────────────
    console.log('[IMPORT ALL] Processing tickets...');
    const ticketRecords = await parseCSV(files.tickets[0].buffer);
    console.log(`[IMPORT ALL] Parsed ${ticketRecords.length} ticket records`);

    // Build asset name → {id, itemType} map for linking
    const assetByName: Record<string, { id: number; itemType: string }> = {};
    assetRecords.forEach((rec: any, idx: number) => {
      const a = createdAssets[idx];
      if (a) assetByName[rec.Name?.trim().toLowerCase()] = a;
    });

    for (const record of ticketRecords) {
      const csvRef = String(record.Ref_Ticket || '').trim();
      console.log(`[IMPORT ALL] Processing ticket: ${record.Titre} (Ref: ${csvRef})`);
      console.log(`[IMPORT ALL] Ticket record data:`, record);

      const payload = buildTicketPayload(record);
      const itemNames: string[] = payload._item_names || [];
      delete payload._item_names; // not a GLPI API field

      console.log(`[IMPORT ALL] Ticket payload for ${record.Titre}:`, payload);

      const response = await glpiApiService.post('/Assistance/Ticket', payload);
      const glpiTicketId: number = response.id;
      createdTickets.push(glpiTicketId);

      if (csvRef) {
        csvRefToGlpiId[csvRef] = glpiTicketId;
        console.log(`[IMPORT ALL] Mapped CSV Ref ${csvRef} -> GLPI ID ${glpiTicketId}`);
      }

      // Link assets to ticket via Legacy API (POST /apirest.php/Item_Ticket)
      // The High-Level API v2.3 has no direct endpoint for this relationship.
      if (itemNames.length > 0) {
        for (const assetName of itemNames) {
          const matched = assetByName[assetName.trim().toLowerCase()];
          if (matched) {
            try {
              await glpiApiService.postLegacy('/Item_Ticket', {
                input: {
                  tickets_id: glpiTicketId,
                  itemtype:   matched.itemType,
                  items_id:   matched.id,
                }
              });
              console.log(`[IMPORT ALL] Linked asset "${assetName}" (${matched.itemType}#${matched.id}) → Ticket ${glpiTicketId}`);
            } catch (linkErr: any) {
              console.warn(`[IMPORT ALL] Could not link asset "${assetName}" to ticket ${glpiTicketId}: ${linkErr?.response?.data?.message || linkErr?.message}`);
            }
          } else {
            console.warn(`[IMPORT ALL] Asset "${assetName}" not found in import batch — skipping link`);
          }
        }
      }

      console.log(`[IMPORT ALL] Successfully created ticket ${record.Titre} with GLPI ID: ${glpiTicketId}`);
    }
    console.log(`[IMPORT ALL] Tickets import complete: ${createdTickets.length} created`);
    console.log(`[IMPORT ALL] Reference mapping:`, csvRefToGlpiId);

    // ── 3. Costs ───────────────────────────────────────────────────────────
    console.log('[IMPORT ALL] Processing costs...');
    const costRecords = await parseCSV(files.costs[0].buffer);
    console.log(`[IMPORT ALL] Parsed ${costRecords.length} cost records`);

    for (const record of costRecords) {
      const csvRef    = String(record.Num_Ticket || '').trim();
      const glpiTicketId = csvRefToGlpiId[csvRef];

      console.log(`[IMPORT ALL] Processing cost for ticket Ref: ${csvRef}`);
      console.log(`[IMPORT ALL] Cost record data:`, record);

      if (!glpiTicketId) {
        throw new Error(`Cost references CSV Ref_Ticket "${csvRef}" but no matching ticket was created`);
      }

      console.log(`[IMPORT ALL] Mapped ticket Ref ${csvRef} -> GLPI ID ${glpiTicketId}`);

      // Build payload WITHOUT ticket field — the ticket id goes in the URL only
      const costPayload = buildCostPayload(record, csvRef);
      console.log(`[IMPORT ALL] Cost payload:`, costPayload);

      // POST /Assistance/Ticket/:glpiTicketId/Cost
      const costResp = await glpiApiService.post(`/Assistance/Ticket/${glpiTicketId}/Cost`, costPayload);
      createdCosts.push({ ticketId: glpiTicketId, costId: costResp.id });
      console.log(`[IMPORT ALL] Successfully created cost with GLPI ID: ${costResp.id}`);
    }
    console.log(`[IMPORT ALL] Costs import complete: ${createdCosts.length} created`);

    // ── 4. Images — save locally + create GLPI Document record with link URL ──
    // NOTE: /Management/Document only accepts application/json (no multipart).
    // Binary upload requires the Legacy API (/apirest.php/Document).
    // Strategy: save locally → serve via Express static → store public URL in Document.link.
    console.log('[IMPORT ALL] Processing images...');
    const zip = new AdmZip(files.images[0].buffer);
    const entries = zip.getEntries();
    console.log(`[IMPORT ALL] Found ${entries.length} entries in zip file`);

    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    let savedImages  = 0;
    let uploadedDocs = 0;

    // Build name→{id,itemType} map from assets created in this run
    const assetNameMap: Record<string, { id: number; itemType: string }> = {};
    assetRecords.forEach((rec: any, idx: number) => {
      const asset = createdAssets[idx];
      if (asset) {
        const key = rec.Name?.trim().toLowerCase();
        assetNameMap[key] = asset;
      }
    });

    const PUBLIC_BASE = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`;

    for (const entry of entries) {
      if (entry.isDirectory || !entry.entryName.startsWith('images/')) continue;

      const filename  = path.basename(entry.entryName);
      const imageData = entry.getData();

      // 4a. Save locally (served as static files by Express)
      const localPath = path.join(IMAGES_DIR, filename);
      fs.writeFileSync(localPath, imageData);
      console.log(`[IMPORT ALL] Saved image: ${filename}`);
      savedImages++;

      // 4b. Create GLPI Document record with public URL in `link` field
      // This is the correct JSON approach since multipart is not supported by the High-Level API.
      try {
        const publicUrl = `${PUBLIC_BASE}/images/${encodeURIComponent(filename)}`;
        const docResp = await glpiApiService.post('/Management/Document', {
          name:     path.parse(filename).name,
          filename: filename,
          mime:     getMimeType(filename),
          link:     publicUrl,
          entity:   { id: 0 },
        });
        const docId: number = docResp.id;
        createdDocIds.push(docId);
        uploadedDocs++;
        console.log(`[IMPORT ALL] Created Document "${filename}" (link: ${publicUrl}) → GLPI ID: ${docId}`);

        // 4c. Link document to matching asset via Legacy API (POST /apirest.php/Document_Item)
        // The High-Level API has no nested /Assets/{type}/{id}/Document endpoint.
        const baseName = path.parse(filename).name.toLowerCase();
        const matchedAsset = assetNameMap[baseName];

        if (matchedAsset) {
          try {
            await glpiApiService.postLegacy('/Document_Item', {
              input: {
                documents_id: docId,
                itemtype:     matchedAsset.itemType,
                items_id:     matchedAsset.id,
              }
            });
            console.log(`[IMPORT ALL] Linked Document ${docId} → ${matchedAsset.itemType} #${matchedAsset.id}`);
          } catch (linkErr: any) {
            console.warn(`[IMPORT ALL] Could not link document to asset "${baseName}": ${linkErr?.response?.data?.message || linkErr?.message}`);
          }
        } else {
          console.log(`[IMPORT ALL] No asset matched for "${filename}" — document created without asset link`);
        }
      } catch (uploadErr: any) {
        console.error(`[IMPORT ALL] Failed to create Document for "${filename}": ${uploadErr?.response?.data?.title || uploadErr?.message}`);
      }
    }
    console.log(`[IMPORT ALL] Images complete: ${savedImages} saved locally, ${uploadedDocs} GLPI Documents created`);

    const results = {
      assets:    createdAssets.length,
      tickets:   createdTickets.length,
      costs:     createdCosts.length,
      images:    savedImages,
      documents: uploadedDocs,
      ticketRefMap: csvRefToGlpiId,
    };

    console.log('[IMPORT ALL] Transaction complete successfully:', results);
    res.json({ success: true, results });

  } catch (error: any) {
    console.error('[IMPORT ALL] Transaction failed, rolling back:', error.message);
    await rollback();
    res.status(500).json({
      error:  'Import failed — all changes rolled back',
      detail: error.message,
    });
  }
});

export default router;