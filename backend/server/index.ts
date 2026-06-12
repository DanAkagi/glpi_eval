import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { createServer } from 'http';
import path from 'path';
import { glpiApiService } from './services/glpiApi.js';
import authRoutes from './routes/auth.js';
import importRoutes from './routes/import.js';
import statsRoutes from './routes/stats.js';
import ticketRoutes from './routes/tickets.js';
import assetRoutes from './routes/assets.js';
import resetRoutes from './routes/reset.js';
import documentRoutes from './routes/documents.js';
import kanbanRoutes from './routes/kanban.js';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'back-office-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static images
app.use('/images', express.static(path.join(process.cwd(), 'public', 'images')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/import', importRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/kanban', kanbanRoutes);
app.use('/api/reset', resetRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize GLPI API and start server
async function startServer() {
  try {
    await glpiApiService.authenticate();
    console.log('GLPI API authentication initialized');
    
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { app };
