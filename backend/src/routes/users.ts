import { Router } from 'express'
import { UserController } from '../controllers/UserController.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
const userController = new UserController()


// Appliquer le middleware d'authentification aux autres routes
router.use(authMiddleware)

// Recherche d'utilisateurs
router.get('/search', userController.search.bind(userController))

// Récupérer tous les utilisateurs
router.get('/', userController.getAll.bind(userController))

// Récupérer un utilisateur par ID
router.get('/:id', userController.getById.bind(userController))

// Mettre à jour un utilisateur
router.put('/:id', userController.update.bind(userController))

// Upload d'avatar
router.post('/:id/avatar', userController.uploadAvatar.bind(userController))

// Supprimer un utilisateur
router.delete('/:id', userController.delete.bind(userController))

// Suppression de compte (soft delete)
router.delete('/delete-account', userController.deleteAccount.bind(userController))

export default router
