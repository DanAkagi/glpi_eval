import { Router, Request, Response } from 'express';
import multer from 'multer';
import { glpiApiService } from '../services/glpiApi';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// POST /documents - Upload a document (image)
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const formData = new FormData();
    formData.append('uploadFile', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);
    formData.append('filename', req.file.originalname);

    const response = await glpiApiService.post('/Document', formData);
    res.json(response);
  } catch (error) {
    console.error('Failed to upload document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// POST /documents/link - Link a document to an asset
router.post('/link', async (req: Request, res: Response) => {
  try {
    const { documents_id, itemtype, items_id } = req.body;

    if (!documents_id || !itemtype || !items_id) {
      return res.status(400).json({ error: 'Missing required fields: documents_id, itemtype, items_id' });
    }

    const payload = {
      input: {
        documents_id,
        itemtype,
        items_id,
      },
    };

    const response = await glpiApiService.post('/Document_Item', payload);
    res.json(response);
  } catch (error) {
    console.error('Failed to link document to asset:', error);
    res.status(500).json({ error: 'Failed to link document to asset' });
  }
});

// GET /documents/asset/:itemtype/:items_id - Get documents for a specific asset
router.get('/asset/:itemtype/:items_id', async (req: Request, res: Response) => {
  try {
    const { itemtype, items_id } = req.params;
    
    // Get Document_Item entries for this asset
    const response = await glpiApiService.get('/Document_Item', {
      itemtype,
      items_id,
    });

    // GLPI API returns data in different formats - handle both array and object
    const documentItems = Array.isArray(response) ? response : (response?.data || []);
    
    // Extract document IDs and fetch document details
    const documentIds = documentItems.map((item: any) => item.documents_id).filter(Boolean);
    const documents = [];

    for (const docId of documentIds) {
      try {
        const docDetails = await glpiApiService.get(`/Document/${docId}`);
        documents.push({
          id: docDetails.id,
          filename: docDetails.filename,
          mime: docDetails.mime,
          download_url: `/api/documents/${docId}/download`,
        });
      } catch (err) {
        console.error(`Failed to fetch document ${docId}:`, err);
      }
    }

    res.json(documents);
  } catch (error) {
    console.error('Failed to get documents for asset:', error);
    res.status(500).json({ error: 'Failed to get documents for asset' });
  }
});

// GET /documents/:id - Get document by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const response = await glpiApiService.get(`/Document/${req.params.id}`);
    res.json(response);
  } catch (error) {
    console.error('Failed to get document:', error);
    res.status(500).json({ error: 'Failed to get document' });
  }
});

export default router;
