import { Router } from 'express';
import fs from 'fs';
import path from 'path';
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

    // 4. Delete all Documents (GLPI Management/Document) + local image files
    try {
      const documents = await glpiApiService.get('/Management/Document', { limit: 10000 });
      let deletedDocs = 0;
      for (const doc of (documents || [])) {
        try {
          await glpiApiService.delete(`/Management/Document/${doc.id}`, true);
          deletedDocs++;
        } catch (e: any) {
          errors.push(`Delete Document#${doc.id}: ${e?.message}`);
        }
      }
      results['Document'] = deletedDocs;
    } catch (e: any) {
      errors.push(`Fetch documents: ${e?.message}`);
    }

    // 5. Clear local image files in public/images
    try {
      const imagesDir = path.join(process.cwd(), 'public', 'images');
      if (fs.existsSync(imagesDir)) {
        const files = fs.readdirSync(imagesDir);
        let deletedFiles = 0;
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(imagesDir, file));
            deletedFiles++;
          } catch (e: any) {
            errors.push(`Delete file ${file}: ${e?.message}`);
          }
        }
        results['ImageFiles'] = deletedFiles;
      }
    } catch (e: any) {
      errors.push(`Clear image files: ${e?.message}`);
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