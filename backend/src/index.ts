import express from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import { connectPostgres, connectMongoDB, closeConnections } from './config/database.js'
import { socketService } from './services/SocketService.js'
import authRoutes from './routes/auth.js'
import postRoutes from './routes/posts.js'
import friendRoutes from './routes/friends.js'
import userRoutes from './routes/users.js'
import reactionRoutes from './routes/reactions.js'
import notificationRoutes from './routes/notifications.js'
import commentRoutes from './routes/comments.js'
import commentReactionRoutes from './routes/comment-reactions.js'
import messageRoutes from './routes/messages.js'
import postAttachmentRoutes from './routes/post-attachments.js'

// Charger les variables d'environnement
dotenv.config()

const app = express()
const server = createServer(app)
const io = new SocketIOServer(server, {
  cors: {
    origin: true, // Accepte n'importe quelle origine pour les tunnels Cloudflare
    credentials: true,
    methods: ['GET', 'POST']
  }
})

// Initialiser le service Socket.IO
socketService.setIO(io)
const PORT = process.env.PORT || 3000

// Middleware CORS amélioré - ultra permissif pour le développement (accepte n'importe quelle origine)
app.use(cors({
  origin: '*', // Accepter absolument n'importe quelle origine
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'X-Requested-With', 'X-Forwarded-For', 'User-Agent', 'Origin', 'Referer', 'Content-Disposition', 'Content-Length'],
  optionsSuccessStatus: 200,
  preflightContinue: true,
  exposedHeaders: ['Content-Length', 'Content-Type']
}))

// Middleware pour gérer explicitement les requêtes OPTIONS avec maximum de permissivité
app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.referer || '*'
  
  // Ajouter les headers CORS pour TOUTES les requêtes
  res.header('Access-Control-Allow-Origin', '*') // Accepter n'importe quelle origine
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, X-Requested-With, X-Forwarded-For, User-Agent, Origin, Referer, Content-Disposition, Content-Length, Content-MD5')
  res.header('Access-Control-Allow-Credentials', 'true')
  res.header('Access-Control-Max-Age', '86400') // 24 heures
  res.header('Vary', 'Origin')
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type')
  
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS request handled for:', req.path, 'from origin:', origin)
    return res.status(200).json({ success: true })
  }
  next()
})

// Middleware de debug pour voir le corps brut des requêtes
app.use((req, res, next) => {
  if (req.path === '/api/auth/register' && req.method === 'POST') {
    console.log('🔍 Raw Debug - Headers:', req.headers)
    console.log('🔍 Raw Debug - Body brut avant parsing:', req.body)
    console.log('🔍 Raw Debug - Content-Type:', req.headers['content-type'])
    console.log('🔍 Raw Debug - Content-Length:', req.headers['content-length'])
  }
  next()
})

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Middleware pour servir les fichiers avec support HTTP Range Requests (streaming vidéo)
app.use('/files', async (req, res, next) => {
  try {
    const filePath = decodeURIComponent(req.path)
    const fullPath = path.join(process.cwd(), 'public/files', filePath)
    
    // Vérifier si le fichier existe
    try {
      await fsPromises.access(fullPath)
    } catch {
      return res.status(404).json({ error: 'Fichier non trouvé' })
    }
    
    const stats = await fsPromises.stat(fullPath)
    const fileSize = stats.size
    const range = req.headers.range
    
    // Headers CORS pour tous les fichiers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Content-Length, If-Range')
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none')
    res.setHeader('Accept-Ranges', 'bytes')
    
    // Déterminer le Content-Type selon l'extension
    const ext = path.extname(filePath).toLowerCase()
    const contentType = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    }[ext] || 'application/octet-stream'
    
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', fileSize)
    
    // Gérer les requêtes HEAD
    if (req.method === 'HEAD') {
      return res.status(200).end()
    }
    
    // Si pas de header Range, envoyer le fichier entier
    if (!range) {
      console.log(`📁 Fichier entier servi: ${filePath} (${fileSize} bytes)`)
      return res.sendFile(fullPath)
    }
    
    // Parser et valider le header Range
    const rangeMatch = range.match(/bytes=(\d+)-(\d*)/)
    if (!rangeMatch) {
      console.log(`❌ Header Range invalide: ${range}`)
      return res.status(416).json({ error: 'Header Range invalide' })
    }
    
    const start = parseInt(rangeMatch[1], 10)
    const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1
    const chunksize = (end - start) + 1
    
    // Valider le range
    if (start >= fileSize || end >= fileSize || start > end || start < 0) {
      console.log(`❌ Range hors limites: ${start}-${end} (fichier: ${fileSize} bytes)`)
      res.setHeader('Content-Range', `bytes */${fileSize}`)
      return res.status(416).json({ error: 'Range demandé invalide' })
    }
    
    // Headers pour la réponse partielle
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`)
    res.setHeader('Content-Length', chunksize)
    res.setHeader('Cache-Control', 'public, max-age=3600') // Cache 1 heure
    res.status(206) // Partial Content
    
    console.log(`🎬 Streaming vidéo: ${filePath} bytes=${start}-${end}/${fileSize}`)
    
    // Créer un stream pour le chunk demandé
    const fileStream = fs.createReadStream(fullPath, { start, end })
    
    fileStream.on('error', (error) => {
      console.error('❌ Erreur stream vidéo:', error)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erreur lecture fichier' })
      }
    })
    
    fileStream.on('open', () => {
      console.log(`✅ Stream ouvert pour: ${filePath}`)
    })
    
    fileStream.on('close', () => {
      console.log(`🔚 Stream fermé pour: ${filePath}`)
    })
    
    fileStream.pipe(res)
    
  } catch (error) {
    console.error('❌ Erreur middleware fichiers:', error)
    next(error)
  }
})

app.use('/images', express.static('public/images'))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/users', userRoutes)
app.use('/api/friends', friendRoutes)
app.use('/api/chats', messageRoutes)
app.use('/api/reactions', reactionRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/comment-reactions', commentReactionRoutes)
app.use('/api', postAttachmentRoutes)

// Rendre Socket.IO disponible pour les contrôleurs
app.set('io', io)

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'Backend hybride fonctionne !',
    timestamp: new Date(),
    databases: {
      postgresql: 'connecté',
      mongodb: 'connecté'
    }
  })
})

// Gestion des erreurs
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Erreur interne du serveur' })
})

// Configuration Socket.IO pour le temps réel
io.on('connection', (socket) => {
  console.log(`🔌 Utilisateur connecté: ${socket.id}`)

  // Rejoindre la room personnelle de l'utilisateur pour les notifications
  socket.on('joinUserRoom', (userId: number) => {
    socket.join(`user_${userId}`)
    console.log(`👤 Utilisateur ${socket.id} a rejoint sa room personnelle user_${userId}`)
  })

  // Rejoindre une room pour les messages privés
  socket.on('joinChat', (chatId: string) => {
    socket.join(`chat_${chatId}`)
    console.log(`📱 Utilisateur ${socket.id} a rejoint le chat ${chatId}`)
  })

  // Quitter une room de chat
  socket.on('leaveChat', (chatId: string) => {
    socket.leave(`chat_${chatId}`)
    console.log(`📱 Utilisateur ${socket.id} a quitté le chat ${chatId}`)
  })

  // Envoyer un message en temps réel
  socket.on('sendMessage', (data) => {
    const { chatId, message } = data
    socket.to(`chat_${chatId}`).emit('newMessage', { chatId, message })
    console.log(`💬 Message envoyé au chat ${chatId}`)
  })

  // Nouveau post en temps réel
  socket.on('newPost', (post) => {
    socket.broadcast.emit('postCreated', post)
    console.log(`📝 Nouveau post diffusé à tous les utilisateurs`)
  })

  // Post mis à jour en temps réel
  socket.on('updatePost', (post) => {
    socket.broadcast.emit('postUpdated', post)
    console.log(`✏️ Post mis à jour diffusé à tous les utilisateurs`)
  })

  // Post supprimé en temps réel
  socket.on('deletePost', (postId) => {
    socket.broadcast.emit('postDeleted', { postId })
    console.log(`🗑️ Post supprimé diffusé à tous les utilisateurs`)
  })

  // Nouvelle réaction en temps réel
  socket.on('newReaction', (data) => {
    const { postId, reaction } = data
    socket.broadcast.emit('reactionAdded', { postId, reaction })
    console.log(`❤️ Nouvelle réaction "${reaction.type}" pour le post ${postId}`)
  })

  // Nouvelle réaction de commentaire en temps réel
  socket.on('newCommentReaction', (data) => {
    const { commentId, reaction } = data
    socket.broadcast.emit('commentReactionAdded', { commentId, reaction })
    console.log(`😄 Nouvelle réaction "${reaction.type}" pour le commentaire ${commentId}`)
  })

  // Nouvelle réaction de message en temps réel
  socket.on('newMessageReaction', (data) => {
    const { messageId, reaction, chatId } = data
    socket.to(`chat_${chatId}`).emit('messageReactionAdded', { messageId, reaction, chatId })
    console.log(`😊 Nouvelle réaction "${reaction.type}" pour le message ${messageId} dans le chat ${chatId}`)
  })

  // Mise à jour de réaction de message en temps réel
  socket.on('updateMessageReaction', (data) => {
    const { messageId, reaction, chatId } = data
    socket.to(`chat_${chatId}`).emit('messageReactionUpdated', { messageId, reaction, chatId })
    console.log(`🔄 Réaction "${reaction.type}" mise à jour pour le message ${messageId} dans le chat ${chatId}`)
  })

  // Suppression de réaction de message en temps réel
  socket.on('removeMessageReaction', (data) => {
    const { messageId, reaction, chatId } = data
    socket.to(`chat_${chatId}`).emit('messageReactionRemoved', { messageId, reaction, chatId })
    console.log(`❌ Réaction "${reaction.type}" supprimée pour le message ${messageId} dans le chat ${chatId}`)
  })

  // Nouveau commentaire en temps réel
  socket.on('newComment', (data) => {
    const { postId, comment } = data
    socket.broadcast.emit('commentAdded', { postId, comment })
    console.log(`💬 Nouveau commentaire pour le post ${postId}`)
  })

  // Profil mis à jour en temps réel
  socket.on('updateProfile', (user) => {
    socket.broadcast.emit('profileUpdated', user)
    console.log(`👤 Profil mis à jour diffusé à tous les utilisateurs`)
  })

  // Avatar uploadé en temps réel
  socket.on('uploadAvatar', (userId, path) => {
    socket.broadcast.emit('avatarUploaded', { userId, path })
    console.log(`👤 Avatar uploadé pour l'utilisateur ${userId}`)
  })

  // Modification de message en temps réel
  socket.on('updateMessage', (data) => {
    const { chatId, message } = data
    socket.to(`chat_${chatId}`).emit('messageUpdated', message)
    console.log(`✏️ Message mis à jour dans le chat ${chatId}`)
  })

  // Suppression de message en temps réel
  socket.on('deleteMessage', (data) => {
    const { chatId, messageId } = data
    socket.to(`chat_${chatId}`).emit('messageDeleted', { messageId })
    console.log(`🗑️ Message supprimé dans le chat ${chatId}`)
  })

  // Modification de post en temps réel
  socket.on('updatePost', (post) => {
    socket.broadcast.emit('postUpdated', post)
    console.log(`✏️ Post mis à jour`)
  })

  // Suppression de post en temps réel
  socket.on('deletePost', (postId) => {
    socket.broadcast.emit('postDeleted', { postId })
    console.log(`🗑️ Post supprimé: ${postId}`)
  })

  // Mise à jour du profil utilisateur en temps réel
  socket.on('updateProfile', (user) => {
    socket.broadcast.emit('profileUpdated', user)
    console.log(`👤 Profil mis à jour: ${user.name}`)
  })

  // Changement de statut utilisateur en temps réel
  socket.on('updateStatus', (data) => {
    const { userId, status } = data
    socket.broadcast.emit('statusUpdated', { userId, status })
    console.log(`🔄 Statut mis à jour: utilisateur ${userId} → ${status}`)
  })

  // Utilisateur connecté/déconnecté
  socket.on('userStatusChange', (data) => {
    const { userId, status, user } = data
    socket.broadcast.emit('userOnlineStatus', { userId, status, user })
    console.log(`👤 Utilisateur ${userId} est maintenant ${status}`)
  })

  // Déconnexion
  socket.on('disconnect', () => {
    console.log(`🔌 Utilisateur déconnecté: ${socket.id}`)
  })
})

// Démarrage du serveur
const startServer = async () => {
  try {
    // Connexions aux bases de données
    await connectPostgres()
    await connectMongoDB()

    // Démarrer le serveur
    server.listen(PORT, () => {
      console.log(`🚀 Serveur backend hybride démarré sur http://localhost:${PORT}`)
      console.log(`🔌 Socket.IO activé pour le temps réel`)
      console.log(`📊 API disponible sur http://localhost:${PORT}/api`)
      console.log(`❤️  Santé du serveur: http://localhost:${PORT}/api/health`)
      console.log(`🗄️  PostgreSQL: Données structurées (users, posts, chats)`)
      console.log(`🍃 MongoDB: Données dynamiques (comments, messages, reactions, notifications)`)
    })
  } catch (error) {
    console.error('❌ Erreur au démarrage du serveur:', error)
    process.exit(1)
  }
}

// Gestion de l'arrêt gracieux
process.on('SIGINT', async () => {
  console.log('\n🔄 Arrêt gracieux du serveur...')
  await closeConnections()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🔄 Arrêt gracieux du serveur...')
  await closeConnections()
  process.exit(0)
})

startServer()
