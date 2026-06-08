import { Router } from 'express';

const router = Router();

// Single shared access code (set via env or default for dev)
const BACKOFFICE_CODE = process.env.BACKOFFICE_CODE || 'ADMIN123';

router.post('/login', (req, res) => {
  const { code } = req.body;

  if (!code || code.trim() === '') {
    return res.status(400).json({ error: 'Code is required' });
  }

  if (code.trim() !== BACKOFFICE_CODE) {
    return res.status(401).json({ error: 'Invalid code' });
  }

  (req.session as any).authenticated = true;
  (req.session as any).authCode = code.trim();

  res.json({ success: true, message: 'Authenticated successfully' });
});

router.get('/status', (req, res) => {
  const session = req.session as any;
  res.json({
    authenticated: session.authenticated || false,
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Failed to logout' });
    res.json({ success: true });
  });
});

export default router;