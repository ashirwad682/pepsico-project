import React from 'react'
import { useLocation, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import BrandVideoLogo from './BrandVideoLogo'

export default function Footer() {
  const { pathname } = useLocation()
  const hideFooter = pathname.startsWith('/admin/dashboard')
    || pathname.startsWith('/delivery-dashboard')
    || pathname.startsWith('/delevery')
    || pathname.startsWith('/manager-dashboard')
    || pathname.startsWith('/warehouse-dashboard')
    || pathname === '/warehouse'
    || pathname === '/warehouse-login'
    || pathname === '/dashboard/order-success'

  if (hideFooter) return null

  return (
    <footer className="site-footer">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="site-footer__inner"
      >
        <div className="site-footer__grid">
          {/* Brand Section */}
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <BrandVideoLogo size={64} style={{ boxShadow: '0 26px 70px rgba(0,0,0,0.36)', borderRadius: 18 }} />
              <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: 3, textTransform: 'uppercase', lineHeight: 1.1 }}>ASHIRWAD</div>
                  <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', lineHeight: 1.1, opacity: 0.92 }}>ENTERPRISES</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '4px 0 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.36)' }} />
                    <span style={{ fontSize: 7, lineHeight: 1, color: 'rgba(255,255,255,0.62)' }}>◆</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.36)' }} />
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: 'var(--text-muted)', textTransform: 'uppercase' }}>PepsiCo Distributor</div>
              </div>
            </div>
            <p style={{ margin: 0, opacity: 0.9, fontSize: 13, lineHeight: 1.7 }}>
              Premium distribution technology to plan releases, push orders, and deliver a unified PepsiCo experience across every territory.
            </p>
          </div>

          {/* Quick Links */}
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.9 }}>Quick Links</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <FooterLink label="Home" href="/" />
              <FooterLink label="Dashboard" href="/dashboard" />
              <FooterLink label="About" href="/about" />
              <FooterLink label="Contact" href="/contact" />
            </div>
          </div>

          {/* Support */}
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.9 }}>Support</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <FooterLink label="🎫 Raise Ticket" href="/support/ticket" />
              <FooterLink label="💬 Chat Assistance" href="/support/chat" />
              <FooterAnchor href="mailto:ashirwadenterprisesbihar@gmail.com">📧 Email Support</FooterAnchor>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>🕐 Support window: 24/7</div>
            </div>
          </div>

          {/* Legal */}
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.9 }}>Legal</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <FooterLink label="Terms & Conditions" href="/terms-conditions" />
              <FooterLink label="Privacy Policy" href="/privacy-policy" />
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="site-footer__base">
          <div>
            © {new Date().getFullYear()} Ashirwad Enterprises. Celebrating Chaitra Navratri &amp; Chhath Puja spirit.
          </div>
          {/* <div>
            Powered by React, Node.js & Supabase
          </div> */}
        </div>
      </motion.div>
    </footer>
  )
}

function FooterLink({ label, href }) {
  return (
    <Link
      to={href}
      style={{
        color: 'rgba(255,255,255,0.8)',
        textDecoration: 'none',
        transition: 'color 0.2s ease'
      }}
      onMouseEnter={(event) => { event.target.style.color = '#fff' }}
      onMouseLeave={(event) => { event.target.style.color = 'rgba(255,255,255,0.8)' }}
    >
      {label}
    </Link>
  )
}

function FooterAnchor({ href, children }) {
  return (
    <a
      href={href}
      style={{
        color: 'rgba(255,255,255,0.8)',
        textDecoration: 'none',
        transition: 'color 0.2s ease'
      }}
      onMouseEnter={(event) => { event.target.style.color = '#fff' }}
      onMouseLeave={(event) => { event.target.style.color = 'rgba(255,255,255,0.8)' }}
    >
      {children}
    </a>
  )
}
