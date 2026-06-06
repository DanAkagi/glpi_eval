import { Request, Response } from 'express'
import { UserService } from '../services/postgres/UserService.js'
import { uploadAvatar } from '../middleware/upload.js'
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js'
import { getPgPool } from '../config/database-sql.js'

const userService = new UserService(getPgPool())

export class UserController {
  async getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const users = await userService.getAll()
      res.json({ users })
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error)
      res.status(500).json({ error: 'Erreur serveur' })
    }
  }

  async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const idNum = Array.isArray(id) ? parseInt(id[0]) : parseInt(id)
      
      if (!idNum || isNaN(idNum)) {
        res.status(400).json({ error: 'ID invalide' })
        return
      }

      const user = await userService.findById(idNum)
      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' })
        return
      }

      res.json(user)
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'utilisateur:', error)
      res.status(500).json({ error: 'Erreur serveur' })
    }
  }

  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const idNum = Array.isArray(id) ? parseInt(id[0]) : parseInt(id)
      
      if (!idNum || isNaN(idNum)) {
        res.status(400).json({ error: 'ID invalide' })
        return
      }

      const userData = req.body
      const user = await userService.update(idNum, userData)
      
      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' })
        return
      }

      res.json(user)
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'utilisateur:', error)
      res.status(500).json({ error: 'Erreur serveur' })
    }
  }

  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const idNum = Array.isArray(id) ? parseInt(id[0]) : parseInt(id)
      
      if (!idNum || isNaN(idNum)) {
        res.status(400).json({ error: 'ID invalide' })
        return
      }

      const success = await userService.delete(idNum, req.user?.id || 0)
      
      if (!success) {
        res.status(404).json({ error: 'Utilisateur non trouvé' })
        return
      }

      res.json({ message: 'Utilisateur supprimé' })
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'utilisateur:', error)
      res.status(500).json({ error: 'Erreur serveur' })
    }
  }

  // Upload d'avatar
  async uploadAvatar(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.id)
      
      console.log('🔍 Backend Debug - req.params.id:', req.params.id)
      console.log('🔍 Backend Debug - userId parsé:', userId)
      console.log('🔍 Backend Debug - req.file:', req.file)
      
      if (!userId) {
        console.log('❌ Backend - ID utilisateur manquant')
        res.status(400).json({ error: 'ID utilisateur manquant' })
        return
      }

      // Utiliser le middleware uploadAvatar directement
      uploadAvatar.single('avatar')(req, res, async (err) => {
        if (err) {
          console.error('Erreur upload avatar:', err)
          res.status(400).json({ error: err.message })
          return
        }

        if (!req.file) {
          res.status(400).json({ error: 'Aucun fichier fourni' })
          return
        }

        try {
          // Générer le chemin relatif (pas l'URL complète)
          const avatarPath = `/files/avatar/${userId}/${req.file.filename}`
          
          // Mettre à jour l'avatar dans la base de données
          await userService.updateAvatar(userId, avatarPath)
          
          console.log('✅ Avatar uploadé avec succès (chemin relatif):', avatarPath)
          
          res.json({
            message: 'Avatar uploadé avec succès',
            avatarPath,
            avatarUrl: avatarPath // Le frontend construira l'URL complète
          })
        } catch (error) {
          console.error('Erreur mise à jour avatar:', error)
          res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'avatar' })
        }
      })
    } catch (error) {
      console.error('Erreur upload avatar:', error)
      res.status(500).json({ error: 'Erreur serveur' })
    }
  }

  // Soft delete du compte
  async deleteAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id // Récupérer l'ID depuis le middleware d'auth
      
      if (!userId) {
        res.status(401).json({ error: 'Utilisateur non authentifié' })
        return
      }

      // Soft delete : marquer l'utilisateur comme supprimé
      await userService.softDelete(userId)
      
      res.status(200).json({
        message: 'Compte supprimé avec succès'
      })
    } catch (error) {
      console.error('Erreur suppression compte:', error)
      res.status(500).json({ error: 'Erreur lors de la suppression du compte' })
    }
  }

  // Recherche d'utilisateurs
  async search(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { q, userId } = req.query
      
      if (!userId) {
        res.status(400).json({ error: 'ID utilisateur manquant' })
        return
      }

      const query = (q as string) || '' // Accepter les requêtes vides
      const currentUserId = parseInt(userId as string)
      
      if (isNaN(currentUserId)) {
        res.status(400).json({ error: 'ID utilisateur invalide' })
        return
      }

      const users = await userService.searchUsers(query, currentUserId)
      res.json(users)
    } catch (error) {
      console.error('Erreur lors de la recherche d\'utilisateurs:', error)
      res.status(500).json({ error: 'Erreur lors de la recherche d\'utilisateurs' })
    }
  }
}
