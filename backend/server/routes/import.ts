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

// Images extraction target (served as static files)
const IMAGES_DIR = path.resolve(process.cwd(), 'public', 'images');

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

// ── Helpers ──────────────────────────────────────────────────────────────────

// Map CSV Status string → GLPI State id
function mapStatus(status: string): { id: number } | undefined {
  const map: Record<string, number> = {
    'En production': 1,
    'En stock':      2,
    'En réparation': 3,
    'Hors service':  4,
    'Volé':          5,
    'Perdu':         6,
  };
  const id = map[status?.trim()];
  return id ? { id } : undefined;
}

// Map CSV Priority string → GLPI int (1–5)
function mapPriority(priority: string): number {
  const map: Record<string, number> = {
    'Very Low': 1, 'Low': 2, 'Medium': 3, 'High': 4, 'Very High': 5,
    'Très basse': 1, 'Basse': 2, 'Moyenne': 3, 'Haute': 4, 'Très haute': 5,
  };
  return map[priority?.trim()] ?? 3;
}

// Parse CSV date/time in European format (DD/MM/YYYY HH:mm) to GLPI format (YYYY-MM-DD HH:mm:ss)
function parseCsvDateTime(dateStr: string, timeStr: string): string {
  if (!dateStr) return new Date().toISOString().slice(0, 19).replace('T', ' ');
  
  // Parse DD/MM/YYYY format
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    
    const time = timeStr ? timeStr.trim() : '00:00';
    // Return GLPI format: YYYY-MM-DD HH:mm:ss
    return `${year}-${month}-${day} ${time}:00`;
  }
  
  return dateStr; // Fallback if format doesn't match
}

// Map CSV Type string → GLPI ticket type int (1=Incident, 2=Request)
function mapTicketType(type: string): number {
  if (!type) return 1;
  const t = type.trim().toLowerCase();
  if (t === 'request' || t === 'demande') return 2;
  return 1; // Incident by default
}

// Map CSV Status string → GLPI ticket status id
function mapTicketStatus(status: string): number {
  const map: Record<string, number> = {
    'New':     1, 'Nouveau': 1,
    'Assigned': 2, 'Attribué': 2,
    'Planned':  3, 'Planifié': 3,
    'Waiting':  4, 'En attente': 4,
    'Solved':   5, 'Résolu': 5,
    'Closed':   6, 'Clos': 6,
  };
  return map[status?.trim()] ?? 1;
}

// Build asset payload from CSV record (Feuille 1)
function buildAssetPayload(record: any) {
  const payload: Record<string, any> = {
    name: record.Name || '',
    entity: { id: 0 },
    otherserial: record.Inventory_Number || '', // Exact CSV column name
  };
  const status = mapStatus(record.Status); // Exact CSV column name
  if (status) payload.status = status;
  // GLPI API accepts objects with name property for auto-creation/matching
  if (record.Location)     payload.locations_id     = { name: record.Location }; // Exact CSV column name
  if (record.Manufacturer) payload.manufacturers_id = { name: record.Manufacturer }; // Exact CSV column name
  if (record.Model)        payload.models_id        = { name: record.Model }; // Exact CSV column name
  if (record.User)         payload.users_id         = { name: record.User }; // Exact CSV column name
  return payload;
}

// Build ticket payload from CSV record (Feuille 2)
function buildTicketPayload(record: any) {
  const dateTime = parseCsvDateTime(record.Date, record.Heure);

  const payload: Record<string, any> = {
    name:     record.Titre || record.Title || '',
    content:  record.Description || '',
    type:     mapTicketType(record.Type),
    status:   { id: mapTicketStatus(record.Status || 'New') },
    priority: mapPriority(record.Priority || 'Medium'),
    date:     dateTime,
  };

  // Store CSV reference as external_id to preserve original ticket number
  if (record.Ref_Ticket) {
    payload.external_id = record.Ref_Ticket;
  }

  if (record.Items) {
    try {
      const items: string[] = JSON.parse(record.Items);
      if (Array.isArray(items) && items.length > 0) {
        // items[] sent as asset names; GLPI expects linked items via separate endpoint
        // Store as external_id for later linking if needed
        payload._item_names = items;
      }
    } catch { /* malformed JSON, skip */ }
  }

  return payload;
}

// Build TicketCost payload from CSV record (Feuille 3)
function buildCostPayload(record: any) {
  return {
    ticket:        { id: parseInt(record.Num_Ticket) },
    name:          `Cost - Ticket ${record.Num_Ticket}`,
    duration:      parseInt(record.Duration_second) || 0,
    cost_time:     parseFloat((record.Time_Cost || '0').replace(',', '.')) || 0,
    cost_fixed:    parseFloat(record.Fixed_Cost)  || 0,
    cost_material: 0,
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────

// POST /import/assets  (Feuille 1)
router.post('/assets', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  console.log('[IMPORT ASSETS] Starting import...');
  const records = await parseCSV(req.file.buffer);
  console.log(`[IMPORT ASSETS] Parsed ${records.length} records from CSV`);

  let ok = 0;
  const errors: string[] = [];

  for (const record of records) {
    // Resolve GLPI itemtype from CSV Item_Type column
    const csvType: string = record.Item_Type || 'Computer';
    const itemType: AssetItemType = CSV_TYPE_TO_GLPI[csvType] || 'Computer';

    console.log(`[IMPORT ASSETS] Processing record: ${record.Name}`);
    console.log(`[IMPORT ASSETS] CSV Type: ${csvType} -> GLPI Type: ${itemType}`);
    console.log(`[IMPORT ASSETS] Record data:`, record);

    try {
      const payload = buildAssetPayload(record);
      console.log(`[IMPORT ASSETS] Payload for ${record.Name}:`, payload);
      
      const response = await glpiApiService.post(`/Assets/${itemType}`, payload);
      console.log(`[IMPORT ASSETS] Successfully created ${record.Name} with ID: ${response.id}`);
      ok++;
    } catch (e: any) {
      console.error(`[IMPORT ASSETS] Failed to create ${record.Name}:`, e?.response?.data || e?.message);
      errors.push(`${record.Name} (${itemType}): ${e?.response?.data?.title || e?.message}`);
    }
  }

  console.log(`[IMPORT ASSETS] Import complete: ${ok} successful, ${errors.length} errors`);
  res.json({ success: true, imported: ok, errors: errors.length, errorDetails: errors });
});

// POST /import/tickets  (Feuille 2)
router.post('/tickets', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const records = await parseCSV(req.file.buffer);
  let ok = 0;
  const errors: string[] = [];

  for (const record of records) {
    try {
      await glpiApiService.post('/Assistance/Ticket', buildTicketPayload(record));
      ok++;
    } catch (e: any) {
      errors.push(`${record.Titre}: ${e?.response?.data?.title || e?.message}`);
    }
  }

  res.json({ success: true, imported: ok, errors: errors.length, errorDetails: errors });
});

// POST /import/costs  (Feuille 3)
router.post('/costs', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const records = await parseCSV(req.file.buffer);
  let ok = 0;
  const errors: string[] = [];

  for (const record of records) {
    const ticketId = parseInt(record.Num_Ticket);
    if (!ticketId) { errors.push(`Invalid Num_Ticket: ${record.Num_Ticket}`); continue; }

    try {
      const costPayload = buildCostPayload(record);

      // 1. Create the cost
      const costResponse = await glpiApiService.post(
        `/Assistance/Ticket/${ticketId}/Cost`,
        costPayload
      );

      // 2. PATCH the ticket to update the costs[] field
      await glpiApiService.patch(`/Assistance/Ticket/${ticketId}`, {
        costs: [{ id: costResponse.id }]
      });

      ok++;
    } catch (e: any) {
      errors.push(`Ticket ${ticketId}: ${e?.response?.data?.title || e?.message}`);
    }
  }

  res.json({ success: true, imported: ok, errors: errors.length, errorDetails: errors });
});

// POST /import/images  (images.zip) - Upload to GLPI Document API
router.post('/images', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();
    let uploaded = 0;
    let linked = 0;
    const errors: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      // Only process images/... entries
      if (!entry.entryName.startsWith('images/')) continue;

      const filename = path.basename(entry.entryName);
      const imageData = entry.getData();

      try {
        // Step 1: Upload image to GLPI Document API
        const formData = new FormData();
        const mimeType = getMimeType(filename);
        formData.append('uploadFile', new Blob([imageData], { type: mimeType }), filename);
        formData.append('filename', filename);

        const docResponse = await glpiApiService.post('/Document', formData);
        const documentId = docResponse.id;

        if (!documentId) {
          errors.push(`${filename}: No document ID returned`);
          continue;
        }

        uploaded++;

        // Step 2: Try to link to asset based on filename pattern
        // Expected pattern: assetname.jpg or assetname-id.jpg or id.jpg
        const assetMatch = filename.match(/^(\d+)|(.+?)-(\d+)/);
        if (assetMatch) {
          const assetId = assetMatch[1] || assetMatch[3];
          const itemType = assetMatch[2] || 'Computer'; // Default to Computer if not specified

          try {
            await glpiApiService.post('/Document_Item', {
              input: {
                documents_id: documentId,
                itemtype: CSV_TYPE_TO_GLPI[itemType] || itemType,
                items_id: parseInt(assetId),
              },
            });
            linked++;
          } catch (linkError) {
            errors.push(`${filename}: Failed to link to asset ${assetId} (${itemType})`);
          }
        }
      } catch (uploadError: any) {
        errors.push(`${filename}: ${uploadError?.response?.data?.title || uploadError?.message}`);
      }
    }

    res.json({ 
      success: true, 
      uploaded, 
      linked, 
      errors: errors.length, 
      errorDetails: errors 
    });
  } catch (e: any) {
    console.error('Import images failed:', e);
    res.status(500).json({ error: 'Failed to process images', detail: e?.message });
  }
});

// Helper function to get MIME type from filename
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
  };
  return mimeTypes[ext] || 'image/jpeg';
}

// POST /import/all  (all 4 files at once) - Transactional
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

  const results: Record<string, any> = {};
  const createdAssetIds: Array<{ id: number; itemType: string }> = [];
  const createdTicketIds: number[] = [];
  const createdCostIds: number[] = [];
  const ticketRefToIdMap: Record<number, number> = {}; // Map CSV Ref_Ticket to GLPI ticket ID
  const costToTicketMap: Record<number, number> = {}; // Map cost ID to ticket ID for rollback

  // Rollback function
  const rollback = async () => {
    console.log('Rolling back transaction...');
    
    // Rollback costs
    for (const costId of createdCostIds) {
      try {
        const ticketId = costToTicketMap[costId];
        if (ticketId) {
          // Use nested endpoint for cost deletion
          await glpiApiService.delete(`/Assistance/Ticket/${ticketId}/Cost/${costId}`);
        } else {
          console.error(`No ticket ID found for cost ${costId}, skipping deletion`);
        }
      } catch (err) {
        console.error(`Failed to delete cost ${costId}:`, err);
      }
    }

    // Rollback tickets
    for (const ticketId of createdTicketIds) {
      try {
        await glpiApiService.delete(`/Assistance/Ticket/${ticketId}`);
      } catch (err) {
        console.error(`Failed to delete ticket ${ticketId}:`, err);
      }
    }

    // Rollback assets
    for (const { id, itemType } of createdAssetIds) {
      try {
        await glpiApiService.delete(`/Assets/${itemType}/${id}`);
      } catch (err) {
        console.error(`Failed to delete asset ${id} (${itemType}):`, err);
      }
    }
  };

  try {
    console.log('[IMPORT ALL] Starting transactional import...');
    
    // Assets
    console.log('[IMPORT ALL] Processing assets...');
    const assetRecords = await parseCSV(files.assets[0].buffer);
    console.log(`[IMPORT ALL] Parsed ${assetRecords.length} asset records`);
    
    for (const record of assetRecords) {
      const itemType: AssetItemType = CSV_TYPE_TO_GLPI[record.Item_Type || ''] || 'Computer';
      console.log(`[IMPORT ALL] Processing asset: ${record.Name} (Type: ${record.Item_Type} -> ${itemType})`);
      console.log(`[IMPORT ALL] Asset record data:`, record);
      
      try {
        const payload = buildAssetPayload(record);
        console.log(`[IMPORT ALL] Asset payload for ${record.Name}:`, payload);
        
        const response = await glpiApiService.post(`/Assets/${itemType}`, payload);
        createdAssetIds.push({ id: response.id, itemType });
        console.log(`[IMPORT ALL] Successfully created asset ${record.Name} with GLPI ID: ${response.id}`);
      } catch (err) {
        console.error(`[IMPORT ALL] Failed to create asset ${record.Name}:`, err);
        throw new Error(`Failed to create asset ${record.Name}`);
      }
    }
    results.assets = createdAssetIds.length;
    console.log(`[IMPORT ALL] Assets import complete: ${createdAssetIds.length} created`);

    // Tickets
    console.log('[IMPORT ALL] Processing tickets...');
    const ticketRecords = await parseCSV(files.tickets[0].buffer);
    console.log(`[IMPORT ALL] Parsed ${ticketRecords.length} ticket records`);
    
    for (const record of ticketRecords) {
      console.log(`[IMPORT ALL] Processing ticket: ${record.Titre} (Ref: ${record.Ref_Ticket})`);
      console.log(`[IMPORT ALL] Ticket record data:`, record);
      
      try {
        const payload = buildTicketPayload(record);
        console.log(`[IMPORT ALL] Ticket payload for ${record.Titre}:`, payload);
        
        const response = await glpiApiService.post('/Assistance/Ticket', payload);
        createdTicketIds.push(response.id);
        console.log(`[IMPORT ALL] Successfully created ticket ${record.Titre} with GLPI ID: ${response.id}`);
        
        // Store mapping from CSV Ref_Ticket to GLPI ticket ID
        if (record.Ref_Ticket) {
          ticketRefToIdMap[parseInt(record.Ref_Ticket)] = response.id;
          console.log(`[IMPORT ALL] Mapped CSV Ref ${record.Ref_Ticket} -> GLPI ID ${response.id}`);
        }
      } catch (err) {
        console.error(`[IMPORT ALL] Failed to create ticket ${record.Titre}:`, err);
        throw new Error(`Failed to create ticket ${record.Titre}`);
      }
    }
    results.tickets = createdTicketIds.length;
    console.log(`[IMPORT ALL] Tickets import complete: ${createdTicketIds.length} created`);
    console.log(`[IMPORT ALL] Reference mapping:`, ticketRefToIdMap);

    // Costs
    console.log('[IMPORT ALL] Processing costs...');
    const costRecords = await parseCSV(files.costs[0].buffer);
    console.log(`[IMPORT ALL] Parsed ${costRecords.length} cost records`);
    
    for (const record of costRecords) {
      const ticketRef = parseInt(record.Num_Ticket);
      if (!ticketRef) continue;
      
      console.log(`[IMPORT ALL] Processing cost for ticket Ref: ${ticketRef}`);
      console.log(`[IMPORT ALL] Cost record data:`, record);
      
      // Use mapping to find the actual GLPI ticket ID
      const ticketId = ticketRefToIdMap[ticketRef];
      if (!ticketId) {
        console.error(`[IMPORT ALL] Ticket with Ref_Ticket ${ticketRef} not found in mapping`);
        throw new Error(`Ticket with Ref_Ticket ${ticketRef} not found`);
      }
      
      console.log(`[IMPORT ALL] Mapped ticket Ref ${ticketRef} -> GLPI ID ${ticketId}`);
      
      try {
        const costPayload = buildCostPayload(record);
        console.log(`[IMPORT ALL] Cost payload:`, costPayload);
        
        const costResp = await glpiApiService.post(`/Assistance/Ticket/${ticketId}/Cost`, costPayload);
        createdCostIds.push(costResp.id);
        costToTicketMap[costResp.id] = ticketId; // Store mapping for rollback
        console.log(`[IMPORT ALL] Successfully created cost with GLPI ID: ${costResp.id}`);
      } catch (err) {
        console.error(`[IMPORT ALL] Failed to create cost for ticket ${ticketId}:`, err);
        throw new Error(`Failed to create cost for ticket ${ticketId}`);
      }
    }
    results.costs = createdCostIds.length;
    console.log(`[IMPORT ALL] Costs import complete: ${createdCostIds.length} created`);

    // Images - Save locally to backend and upload to GLPI
    console.log('[IMPORT ALL] Processing images...');
    const zip = new AdmZip(files.images[0].buffer);
    const entries = zip.getEntries();
    console.log(`[IMPORT ALL] Found ${entries.length} entries in zip file`);

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      if (!entry.entryName.startsWith('images/')) continue;

      const filename = path.basename(entry.entryName);
      const imageData = entry.getData();
      const mimeType = getMimeType(filename);

      try {
        // Save image to local storage
        const imagePath = path.join(IMAGES_DIR, filename);
        fs.writeFileSync(imagePath, imageData);
        console.log(`[IMPORT ALL] Saved image locally: ${filename}`);

        // Upload to GLPI Document API
        const formData = new FormData();
        formData.append('input', JSON.stringify({
          name: filename,
          _filename: [filename]
        }));
        formData.append('filename[0]', new Blob([imageData], { type: mimeType }), filename);

        const docResponse = await glpiApiService.post('/Management/Document', formData);
        console.log(`[IMPORT ALL] Uploaded image to GLPI Document API: ${filename} (ID: ${docResponse.id})`);

        // Try to link to asset based on filename pattern
        const assetMatch = filename.match(/^(\d+)|(.+?)-(\d+)/);
        if (assetMatch) {
          const assetId = assetMatch[1] || assetMatch[3];
          const itemType = assetMatch[2] || 'Computer';
          const glpiType = CSV_TYPE_TO_GLPI[itemType] || itemType;

          try {
            // Use nested endpoint for document linking
            const endpoint = `/Assets/${glpiType}/${assetId}/Document`;
            await glpiApiService.post(endpoint, {
              input: { documents_id: docResponse.id }
            });
            console.log(`[IMPORT ALL] Linked document ${docResponse.id} to asset ${assetId} (${glpiType})`);
          } catch (linkErr) {
            console.error(`[IMPORT ALL] Failed to link document ${docResponse.id} to asset ${assetId}:`, linkErr);
            // Don't fail the transaction if linking fails, just log it
          }
        }
      } catch (saveErr) {
        console.error(`[IMPORT ALL] Failed to process image ${filename}:`, saveErr);
        throw new Error(`Failed to process image ${filename}`);
      }
    }
    results.images = entries.filter(e => !e.isDirectory && e.entryName.startsWith('images/')).length;
    console.log(`[IMPORT ALL] Images import complete: ${results.images} saved`);

    console.log('[IMPORT ALL] Transaction complete successfully:', results);
    res.json({ success: true, results });
  } catch (error: any) {
    console.error('Transaction failed, rolling back:', error);
    
    // Rollback all changes
    await rollback();
    
    res.status(500).json({ 
      error: 'Import failed - all changes rolled back', 
      detail: error.message 
    });
  }
});

export default router;