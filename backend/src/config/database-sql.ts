import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

// Configuration PostgreSQL uniquement (sans MongoDB pour commencer)
const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'social_media_app',
  user: process.env.POSTGRES_USER || 'social_media',
  password: process.env.POSTGRES_PASSWORD || 'friends',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

export const connectPostgres = async (): Promise<void> => {
  try {
    await pgPool.connect()
    console.log('✅ PostgreSQL connecté')
  } catch (error) {
    console.error('❌ Erreur connexion PostgreSQL:', error)
    process.exit(1)
  }
}

export const getPgPool = (): Pool => pgPool

export const closePostgres = async (): Promise<void> => {
  await pgPool.end()
  console.log('🔌 Connexion PostgreSQL fermée')
}

export const closeConnections = async (): Promise<void> => {
  await closePostgres()
}
