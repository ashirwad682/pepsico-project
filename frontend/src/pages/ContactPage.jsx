import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { Link } from 'react-router-dom'
import BrandVideoLogo from '../components/BrandVideoLogo'
import BrandLoadingOverlay from '../components/BrandLoadingOverlay'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001'

export default function ContactPage() {
  const accentFont = "'Space Grotesk', 'Sora', 'Inter', system-ui, -apple-system, sans-serif"
  const [formStatus, setFormStatus] = useState(null)
  const [formError, setFormError] = useState(null)
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' })
  const [user, setUser] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const cardStyle = {
    background: '#fff',
    borderRadius: 22,
    padding: '32px 32px 36px',
    border: '1px solid #e8edf5',
    boxShadow: '0 18px 60px rgba(15,23,42,0.10)'
  }

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser()
      const u = data?.user
      if (u) {
        setUser(u)
        setFormData((f) => ({
          ...f,
          email: u.email || f.email,
          name: u.user_metadata?.full_name || u.email || f.name
        }))
      }
      setLoadingUser(false)
    }
    loadUser()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormStatus('Sending...')
    setFormError(null)
    try {
      const res = await fetch(`${API_BASE}/api/support/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, userId: user?.id })
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to send message')
      }
      const body = await res.json()
      setFormStatus(body.message || 'Message received! We will reply within 2-3 working days.')
      setFormData({ name: user?.user_metadata?.full_name || '', email: user?.email || '', subject: '', message: '' })
      setTimeout(() => setFormStatus(null), 5000)
    } catch (err) {
      setFormStatus(null)
      setFormError(err.message)
    }
  }

  if (loadingUser) return <BrandLoadingOverlay message="Preparing contact workspace…" />

  if (!user) {
    return (
      <div style={{ background: '#f5f7fb', minHeight: '100vh', fontFamily: accentFont, display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ background: '#fff', padding: 32, borderRadius: 16, boxShadow: '0 16px 50px rgba(0,0,0,0.08)', maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <BrandVideoLogo size={70} style={{ margin: '0 auto 16px', display: 'block', boxShadow: '0 14px 36px rgba(10,29,83,0.25)' }} />
          <h2 style={{ marginBottom: 12, color: '#2b7eb8' }}>Please login to contact support</h2>
          <p style={{ color: '#6b7280', marginBottom: 20 }}>The contact form is available after you login so we can auto-fill your registered email.</p>
          <Link to="/login" style={{ display: 'inline-block', padding: '12px 18px', background: '#2b7eb8', color: '#fff', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>Go to Login</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'linear-gradient(180deg, #f5f7fb 0%, #ffffff 60%)', minHeight: '100vh', fontFamily: accentFont, paddingBottom: 64 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 22px' }}>
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ textAlign: 'center', marginBottom: 48 }}>
          <BrandVideoLogo size={80} style={{ margin: '0 auto 18px', display: 'block', boxShadow: '0 18px 48px rgba(10,29,83,0.28)' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '7px 16px', borderRadius: 999, background: '#FFE4B5', color: '#FF8C00', fontWeight: 700, fontSize: 14, letterSpacing: 0.3, marginBottom: 18 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF8C00' }} />
            <span>Ashirwad Support</span>
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, color: '#FF8C00', marginBottom: 14, letterSpacing: '-0.01em' }}>Contact Us</h1>
          <p style={{ color: '#556070', fontSize: 18, maxWidth: 700, margin: '0 auto', lineHeight: 1.7, fontWeight: 500 }}>
            Our support team leverages the latest technology to ensure your questions are answered quickly and securely. Reach out for help, onboarding, or business inquiries_powered by real-time notifications.
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 28, marginBottom: 48 }}>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }} style={cardStyle}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 14, color: '#556070', letterSpacing: 0.2, marginBottom: 4 }}>Message us</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Send a message</div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6, fontWeight: 600 }}>Your name</div>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter your name"
                    required
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #d7deea', outline: 'none', fontSize: 14, fontWeight: 600 }}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6, fontWeight: 600 }}>Email address</div>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your@email.com"
                    required
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #d7deea', outline: 'none', fontSize: 14, fontWeight: 600, background: '#f8fafc' }}
                    readOnly
                  />
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Auto-filled from your login. Replies go here.</div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6, fontWeight: 600 }}>Subject</div>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="How can we help?"
                  required
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #d7deea', outline: 'none', fontSize: 14, fontWeight: 600 }}
                />
              </div>

              <div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6, fontWeight: 600 }}>Message</div>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Tell us about your inquiry..."
                  required
                  rows={4}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #d7deea', outline: 'none', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  background: '#0b5fff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  padding: '14px 16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 12px 30px rgba(11,95,255,0.25)'
                }}
              >
                Send message
              </button>

              {formError && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} style={{ padding: '12px 14px', borderRadius: 12, background: '#fef2f2', color: '#991b1b', fontSize: 14, fontWeight: 600, textAlign: 'center', border: '1px solid #fecdd3' }}>
                  {formError}
                </motion.div>
              )}

              {formStatus && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} style={{ padding: '12px 14px', borderRadius: 12, background: '#f5f8ff', color: '#0b5fff', fontSize: 14, fontWeight: 600, textAlign: 'center', border: '1px solid #cfe3ff' }}>
                  {formStatus}
                </motion.div>
              )}
            </form>
          </motion.div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }} style={cardStyle}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#eef2ff', display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>📧</div>
                <div>
                  <div style={{ fontSize: 13, color: '#556070', marginBottom: 2 }}>Support</div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>ashirwadenterprisesbihar@gmail.com</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Responses in 2-3 working days.</div>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.13 }} style={cardStyle}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#eef2ff', display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>🔑</div>
                <div>
                  <div style={{ fontSize: 13, color: '#556070', marginBottom: 2 }}>Access & Onboarding</div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>Call/WhatsApp: 6204938006</div>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.16 }} style={cardStyle}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#eef2ff', display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>�</div>
                <div>
                  <div style={{ fontSize: 13, color: '#556070', marginBottom: 2 }}>Business Inquiries</div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>ashirwadenterprisesbihar@gmail.com</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} style={{ background: 'linear-gradient(135deg, #fffbe6 0%, #f8fafc 100%)', borderRadius: 22, padding: '32px 28px', marginBottom: 48, boxShadow: '0 8px 32px rgba(255,140,0,0.08)' }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>How can we help?</h2>
          <p style={{ color: '#6b7280', fontSize: 16, lineHeight: 1.7, marginBottom: 10 }}>
            Our digital-first support system uses smart routing and secure cloud infrastructure to connect you with the right expert, fast.
          </p>
          <ul style={{ color: '#FF8C00', fontWeight: 600, fontSize: 15, margin: '18px 0 0 18px', lineHeight: 1.7 }}>
            {/* <li>AI-powered ticket assignment for faster responses</li> */}
            <li>End-to-end encrypted communication</li>
            <li>24/7 access to your support history</li>
          </ul>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.18 }} style={{ ...cardStyle, background: 'linear-gradient(135deg, #f5f7fb 0%, #f8fafc 100%)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Response time</div>
            <p style={{ color: '#556070', marginBottom: 16 }}>We typically respond to inquiries within 24 hours during business days. For urgent support, please mention it in the subject line.</p>
            <div style={{ display: 'inline-flex', gap: 12 }}>
              <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fff', border: '1px solid #d7deea' }}>
                <div style={{ fontSize: 12, color: '#556070', marginBottom: 2 }}>Support response</div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{'< 24hrs'}</div>
              </div>
              <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fff', border: '1px solid #d7deea' }}>
                <div style={{ fontSize: 12, color: '#556070', marginBottom: 2 }}>Access request</div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>1-2 days</div>
              </div>
            </div>
          </div>
        </motion.div>
        

        <div style={{ marginTop: 32, paddingTop: 28, borderTop: '1px solid #e5e7eb', color: '#6b7280', fontSize: 14 }}>
          © PepsiCo Partner – Ashirwad Enterprises. All rights reserved.
        </div>
      </div>
    </div>
  )
}
