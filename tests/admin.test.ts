import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '../app/api/admin/admins/route'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// Mock do Prisma para não tocar no banco de dados real
vi.mock('@/lib/prisma', () => ({
  prisma: {
    admin: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

// Mock do bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
  },
}))

describe('API Admin Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/admin/admins', () => {
    it('lista de todos os adms:', async () => {
      const mockAdmins = [
        { id: '1', email: 'admin1@teste.com', name: 'Admin 1', createdAt: new Date() },
        { id: '2', email: 'admin2@teste.com', name: 'Admin 2', createdAt: new Date() },
      ]

      vi.mocked(prisma.admin.findMany).mockResolvedValue(mockAdmins as any)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(2)
      expect(data[0].email).toBe('admin1@teste.com')
    })
  })

  describe('POST /api/admin/admins', () => {
    it('novo adm criado com sucesso', async () => {
      const payload = { name: 'Novo Admin', email: 'novo@admin.com', password: 'senha123' }

      vi.mocked(prisma.admin.findUnique).mockResolvedValue(null)
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed_password' as never)
      vi.mocked(prisma.admin.create).mockResolvedValue({
        id: '123',
        email: payload.email,
        name: payload.name,
        createdAt: new Date(),
      } as any)

      const req = new NextRequest('http://localhost:3000/api/admin/admins', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.email).toBe(payload.email)
      expect(prisma.admin.create).toHaveBeenCalled()
    })

    it('deve retornar erro 400 se faltar algum campo obrigatório', async () => {
      const payloadIncompleto = { email: 'novo@admin.com' }

      const req = new NextRequest('http://localhost:3000/api/admin/admins', {
        method: 'POST',
        body: JSON.stringify(payloadIncompleto),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('email, password e name são obrigatórios')
    })

    it('retornar erro 409 se o email já estiver cadastrado', async () => {
      const payload = { name: 'Admin Existente', email: 'existente@admin.com', password: '123' }

      vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: '1' } as any)

      const req = new NextRequest('http://localhost:3000/api/admin/admins', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toBe('Email já cadastrado')
    })
  })
})