# GLPI Backend API

This is the backend API server for the GLPI project.

## Setup

1. Copy `.env.example` to `.env` and configure your environment variables
2. Install dependencies: `npm install`
3. Run the server: `npm run dev`

The server will start on port 3001 (or the port specified in your `.env` file).

## API Endpoints

- `POST /api/auth/login` - Login with unique code
- `POST /api/auth/logout` - Logout
- `GET /api/auth/status` - Check authentication status
- `POST /api/reset` - Reset database
- `GET /api/stats` - Get statistics
- `GET /api/tickets` - Get all tickets
- `GET /api/tickets/:id` - Get ticket by ID
- `POST /api/tickets` - Create new ticket
- `GET /api/assets` - Get all assets (with optional filters)
- `GET /api/assets/:id` - Get asset by ID
- `POST /api/import/assets` - Import assets from CSV
- `POST /api/import/tickets` - Import tickets from CSV
- `POST /api/import/costs` - Import costs from CSV
- `POST /api/import/images` - Import images from ZIP
- `POST /api/import/all` - Import all files transactionally
