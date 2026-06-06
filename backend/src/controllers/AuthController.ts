import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { UserService } from '../services/postgres/UserService.js'
import { getPgPool } from '../config/database-sql.js'

const userService = new UserService(getPgPool())

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔍 Debug Register - req.body complet:', req.body)
      console.log('🔍 Debug Register - req.body keys:', Object.keys(req.body))
      console.log('🔍 Debug Register - req.headers content-type:', req.headers['content-type'])
      
      let name, email, password
      
      // Parser manuellement pour éviter les erreurs de parsing
      try {
        const body = req.body
        name = body.name
        email = body.email
        password = body.password
      } catch (parseError) {
        console.error('🔍 Debug Register - Erreur parsing JSON:', parseError)
        res.status(400).json({ error: 'Format JSON invalide' })
        return
      }
      
      console.log('🔍 Debug Register - name:', name)
      console.log('🔍 Debug Register - email:', email) 
      console.log('🔍 Debug Register - password:', password)

      if (!name || !email || !password) {
        res.status(400).json({ error: 'Tous les champs sont requis' })
        return
      }

      const user = await userService.create(name, email, password)
      
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'fallback-secret'
        // Pas d'expiration - token permanent
      )

      res.status(201).json({
        message: 'Inscription réussie',
        user,
        token
      })
    } catch (error) {
      res.status(400).json({ error: (error as Error).message })
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔍 Debug - req.body complet:', req.body)
      console.log('🔍 Debug - req.body keys:', Object.keys(req.body))
      
      const { email, password } = req.body
      
      console.log('🔍 Debug - email extrait:', email)
      console.log('🔍 Debug - password extrait:', password)
      console.log('🔍 Debug - password type:', typeof password)
      
      console.log('🔐 Login attempt:', { email, timestamp: new Date().toISOString() })
      
      if (!email || !password) {
        console.log('❌ Login failed: Missing email or password')
        res.status(400).json({ error: 'Email et mot de passe requis' })
        return
      }
      
      const user = await userService.findByEmail(email)
      console.log('👤 User found:', { id: user?.id, email: user?.email })
      console.log('🔍 Debug - user complet:', user)
      console.log('🔍 Debug - user.password:', user?.password)
      console.log('🔍 Debug - user.password type:', typeof user?.password)
      
      if (!user) {
        console.log('❌ Login failed: User not found')
        res.status(401).json({ error: 'Email ou mot de passe incorrect' })
        return
      }
      
      const bcrypt = await import('bcryptjs')
      const isValidPassword = await bcrypt.compare(password, user.password)
      console.log('🔐 Password validation:', { isValid: isValidPassword })
      
      if (!isValidPassword) {
        console.log('❌ Login failed: Invalid password')
        res.status(401).json({ error: 'Email ou mot de passe incorrect' })
        return
      }
      
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'fallback-secret'
        // { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        // Pas d'expiration - token permanent
      )
      
      console.log('✅ Login successful:', { userId: user.id, email: user.email })
      
      const { password: _, ...userResponse } = user
      
      res.json({
        message: 'Connexion réussie',
        user: userResponse,
        token
      })
    } catch (error) {
      console.error('💥 Login error:', error)
      res.status(500).json({ error: 'Erreur serveur' })
    }
  }

  async getMe(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id
      if (!userId) {
        res.status(401).json({ error: 'Non authentifié' })
        return
      }

      const user = await userService.findById(userId)
      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' })
        return
      }

      res.json(user)
    } catch (error) {
      res.status(500).json({ error: 'Erreur serveur' })
    }
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id
      const { currentPassword, newPassword } = req.body

      if (!userId || !currentPassword || !newPassword) {
        res.status(400).json({ error: 'Données manquantes' })
        return
      }

      if (newPassword.length < 6) {
        res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' })
        return
      }

      // Vérifier le mot de passe actuel et mettre à jour
      const success = await userService.changePassword(userId, currentPassword, newPassword)
      
      if (!success) {
        res.status(400).json({ error: 'Mot de passe actuel incorrect' })
        return
      }

      res.json({
        message: 'Mot de passe mis à jour avec succès'
      })
    } catch (error) {
      console.error('Erreur changement mot de passe:', error)
      res.status(500).json({ error: 'Erreur serveur' })
    }
  }
}
