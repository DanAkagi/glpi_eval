import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserService } from '../services/postgres/UserService.js';
import { getPgPool } from '../config/database-sql.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const userService = new UserService(getPgPool());

interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  type?: string; // Ajouter le type
}

interface AuthenticatedRequest extends Request {
  user?: User;
}

export type { AuthenticatedRequest };

const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      res.status(401).json({ 
        success: false, 
        message: 'Token d\'authentification manquant' 
      });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Récupérer les vraies informations utilisateur depuis PostgreSQL
    const userId = decoded.id || decoded.userId;
    const userFromDb = await userService.findById(userId);
    
    if (userFromDb) {
      req.user = {
        id: userFromDb.id,
        name: userFromDb.name,
        email: userFromDb.email,
        avatar: userFromDb.avatar,
        bio: userFromDb.bio,
        type: userFromDb.type || 'user'
      };
    } else {
      // Fallback si l'utilisateur n'est pas trouvé
      req.user = {
        id: userId,
        name: decoded.name || 'User',
        email: decoded.email || 'user@example.com',
        type: 'user'
      };
    }
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ 
        success: false, 
        message: 'Token invalide ou expiré' 
      });
    } else {
      console.error('Erreur dans le middleware d\'authentification:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur serveur lors de l\'authentification' 
      });
    }
  }
};

export type { AuthenticatedRequest as AuthRequest };
export default authMiddleware;
export { authMiddleware };
export const authenticateToken = authMiddleware;
