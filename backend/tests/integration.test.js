import { jest } from '@jest/globals'
import supertest from 'supertest'

process.env.NODE_ENV = 'test'
process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'test-admin-key'
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'

await jest.unstable_mockModule('node-cron', () => {
  const schedule = jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    destroy: jest.fn()
  }))

  return {
    default: { schedule },
    schedule
  }
})

// Mock emailer and supabase before importing the server
await jest.unstable_mockModule('../lib/emailer.js', () => {
  const mockTransporter = { sendMail: jest.fn(async () => true) }
  const sendWelcomeEmail = jest.fn(async (to, name) => true)
  const sendApprovalEmail = jest.fn(async (to, name, email) => true)
  const sendOtpEmail = jest.fn(async (to, otp) => true)
  const sendOrderConfirmationEmail = jest.fn(async (to, orderData) => true)
  const sendOrderRejectionEmail = jest.fn(async (to, rejectionData) => true)
  const sendDeliveryOtpEmail = jest.fn(async (to, context) => true)
  const sendOrderDeliveredEmail = jest.fn(async (to, context, billPdf) => true)
  const sendEarlyDeliveryEmail = jest.fn(async (to, context) => true)
  const sendDeliveryResetPasswordEmail = jest.fn(async (to, resetLink) => true)
  const ensureTransporter = jest.fn(() => mockTransporter)
  const isMailerConfigured = () => true
  return {
    sendWelcomeEmail,
    sendApprovalEmail,
    sendOtpEmail,
    sendOrderConfirmationEmail,
    sendOrderRejectionEmail,
    sendDeliveryOtpEmail,
    sendOrderDeliveredEmail,
    sendEarlyDeliveryEmail,
    sendDeliveryResetPasswordEmail,
    ensureTransporter,
    isMailerConfigured
  }
})

await jest.unstable_mockModule('@supabase/supabase-js', () => {
  const users = new Map([
    ['uid1', {
      id: 'uid1',
      email: 'mock@example.com',
      full_name: 'Mock User',
      role: 'user',
      is_verified: false
    }]
  ])

  const notifications = []

  const getUserById = (id) => users.get(String(id)) || null

  const createQueryBuilder = (table) => ({
    select: () => ({
      eq: (column, value) => ({
        maybeSingle: async () => {
          if (table === 'users' && column === 'id') {
            return { data: getUserById(value), error: null }
          }
          return { data: null, error: null }
        },
        single: async () => {
          if (table === 'users' && column === 'id') {
            const row = getUserById(value)
            if (!row) {
              return { data: null, error: { message: 'Not found' } }
            }
            return { data: row, error: null }
          }
          return { data: null, error: { message: 'Not found' } }
        }
      })
    }),
    update: (patch = {}) => ({
      eq: (column, value) => ({
        select: async () => {
          if (table === 'users' && column === 'id') {
            const existing = getUserById(value)
            if (!existing) {
              return { data: [], error: null }
            }
            const updated = { ...existing, ...patch }
            users.set(String(value), updated)
            return { data: [updated], error: null }
          }
          return { data: [], error: null }
        }
      })
    }),
    insert: (rows = []) => {
      const insertedRows = Array.isArray(rows) ? rows : [rows]
      if (table === 'notifications') {
        notifications.push(...insertedRows)
      }
      return {
        data: insertedRows,
        error: null,
        select: async () => ({ data: insertedRows, error: null })
      }
    },
    upsert: async (rows = []) => {
      const upsertRows = Array.isArray(rows) ? rows : [rows]
      if (table === 'users') {
        for (const row of upsertRows) {
          const userId = String(row.id)
          const existing = users.get(userId) || {}
          users.set(userId, { ...existing, ...row })
        }
      }
      return { data: upsertRows, error: null }
    }
  })

  return {
    createClient: () => {
      return {
        from: (table) => createQueryBuilder(table),
        auth: {
          admin: {
            updateUserById: async (id) => ({
              data: {
                user: {
                  id,
                  email: 'mock@example.com',
                  user_metadata: { full_name: 'Mock User' },
                  email_confirmed_at: new Date().toISOString()
                }
              },
              error: null
            }),
            getUserById: async (id) => ({
              data: {
                user: {
                  id,
                  email: 'mock@example.com',
                  user_metadata: { full_name: 'Mock User' }
                }
              },
              error: null
            }),
            listUsers: async () => ({
              data: { users: [{ id: 'uid1', email: 'mock@example.com' }] },
              error: null
            }),
            deleteUser: async () => ({ data: {}, error: null })
          }
        },
        storage: {
          from: () => ({
            remove: async () => ({ data: [], error: null }),
            upload: async () => ({ data: {}, error: null }),
            createSignedUrl: async () => ({ data: { signedUrl: null }, error: null })
          })
        }
      }
    }
  }
})

const { default: app } = await import('../server.js')
const request = supertest(app)

afterEach(() => {
  jest.clearAllMocks()
})

afterAll(async () => {
  jest.useRealTimers()
  await new Promise((resolve) => setImmediate(resolve))
})

describe('Registration endpoints (mocked)', () => {
  test('POST /api/auth/confirm-email with email looks up user and responds', async () => {
    const res = await request.post('/api/auth/confirm-email').send({ email: 'mock@example.com' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('success', true)
  })

  test('PATCH /api/admin/users/:userId/verify updates and notifies', async () => {
    const res = await request.patch('/api/admin/users/uid1/verify')
      .set('x-admin-key', process.env.ADMIN_API_KEY)
      .send({ is_verified: true })
    expect([200,201,204]).toContain(res.status)
  })
})
