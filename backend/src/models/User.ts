export interface User {
  id: number
  name: string
  email: string
  password: string
  bio?: string
  status: 'online' | 'offline' | 'away'
  type: 'user' | 'admin'
  created_at: Date
  updated_at: Date
}

export interface CreateUser {
  name: string
  email: string
  password: string
  bio?: string
}

export interface UpdateUser {
  name?: string
  bio?: string
  status?: 'online' | 'offline' | 'away'
}

export interface UserResponse {
  id: number
  name: string
  email: string
  bio?: string
  status: 'online' | 'offline' | 'away'
  type: 'user' | 'admin'
  avatar: string
  created_at: Date
  updated_at: Date
}
