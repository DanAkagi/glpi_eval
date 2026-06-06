// Configuration principale qui utilise les modules séparés
export { connectPostgres, getPgPool, closePostgres } from './database-sql.js'
export { connectMongoDB, getMongoDb, closeMongoDB } from './database-mongo.js'

// Fonction de fermeture combinée
export const closeConnections = async (): Promise<void> => {
  try {
    const { closePostgres } = await import('./database-sql.js')
    await closePostgres()
  } catch (e) {
    console.warn('PostgreSQL déjà fermé ou erreur:', e)
  }
  
  try {
    const { closeMongoDB } = await import('./database-mongo.js')
    await closeMongoDB()
  } catch (e) {
    console.warn('MongoDB déjà fermé ou erreur:', e)
  }
  console.log('🔌 Connexions fermées')
}
