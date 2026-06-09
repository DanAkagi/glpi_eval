import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { glpiApiService } from '../services/glpiApi.js';

const router = Router();
const IMAGES_DIR = path.resolve(process.cwd(), 'public', 'images');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return ({
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif',  '.bmp': 'image/bmp',  '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  })[ext] || 'application/octet-stream';
}

// POST /api/documents
// Upload a file: save locally + create GLPI Document record with link URL.
// NOTE: /Management/Document only accepts application/json (no multipart).
// The file is served by Express static, its URL stored in Document.link.
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    const filename = req.file.originalname;
    const localPath = path.join(IMAGES_DIR, filename);
    fs.writeFileSync(localPath, req.file.buffer);

    const PUBLIC_BASE = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`;
    const publicUrl   = `${PUBLIC_BASE}/images/${encodeURIComponent(filename)}`;

    const response = await glpiApiService.post('/Management/Document', {
      name:     path.parse(filename).name,
      filename: filename,
      mime:     getMimeType(filename),
      link:     publicUrl,
      entity:   { id: 0 },
    });

    res.json({ ...response, local_url: publicUrl });
  } catch (error: any) {
    console.error('Failed to upload document:', error?.response?.data || error?.message);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// POST /api/documents/link
// Link an existing GLPI Document to an asset via Legacy API (Document_Item).
// Body: { documents_id, itemtype, items_id }
router.post('/link', async (req: Request, res: Response) => {
  const { documents_id, itemtype, items_id } = req.body;

  if (!documents_id || !itemtype || !items_id) {
    return res.status(400).json({ error: 'Missing required fields: documents_id, itemtype, items_id' });
  }

  try {
    // Use Legacy API: High-Level API has no Document_Item endpoint
    const response = await glpiApiService.postLegacy('/Document_Item', {
      input: { documents_id, itemtype, items_id }
    });
    res.json(response);
  } catch (error: any) {
    console.error('Failed to link document:', error?.response?.data || error?.message);
    res.status(500).json({ error: 'Failed to link document to asset' });
  }
});

// GET /api/documents/asset/:itemtype/:items_id
// List documents linked to an asset via GLPI Document list filtered by asset.
router.get('/asset/:itemtype/:items_id', async (req: Request, res: Response) => {
  const { itemtype, items_id } = req.params;

  try {
    // GET /Management/Document returns documents; filter by linked item is done
    // via the legacy endpoint or by fetching Document_Item records.
    const docItems = await glpiApiService.getLegacy('/Document_Item', {
      'searchText[itemtype]': itemtype,
      'searchText[items_id]': items_id,
    });

    const docs: any[] = [];
    for (const item of (docItems || [])) {
      try {
        const d = await glpiApiService.get(`/Management/Document/${item.documents_id}`);
        docs.push({
          id:           d.id,
          name:         d.name,
          filename:     d.filename,
          mime:         d.mime,
          link:         d.link,
          download_url: d.download_url,
        });
      } catch { /* skip inaccessible */ }
    }

    res.json(docs);
  } catch (error: any) {
    console.error('Failed to get documents for asset:', error?.response?.data || error?.message);
    res.status(500).json({ error: 'Failed to get documents for asset' });
  }
});

// GET /api/documents/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const response = await glpiApiService.get(`/Management/Document/${req.params.id}`);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get document' });
  }
});

export default router;