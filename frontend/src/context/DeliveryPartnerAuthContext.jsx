import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001'

const DeliveryPartnerAuthContext = createContext()

export const useDeliveryPartnerAuth = () => {
  const context = useContext(DeliveryPartnerAuthContext)
  if (!context) {
    throw new Error('useDeliveryPartnerAuth must be used within DeliveryPartnerAuthProvider')
  }
  return context
}

export const DeliveryPartnerAuthProvider = ({ children }) => {
  const [deliveryPartner, setDeliveryPartner] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    checkDeliveryPartnerAuth()
  }, [])

  const checkDeliveryPartnerAuth = async () => {
    try {
      const dpId = localStorage.getItem('delivery_partner_id')
      if (dpId) {
        const { data, error } = await supabase
          .from('delivery_partners')
          .select('*')
          .eq('id', dpId)
          .single()
        
        if (error) throw error
        setDeliveryPartner(data)
      }
    } catch (err) {
      console.error('Auth check failed:', err)
      localStorage.removeItem('delivery_partner_id')
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/delivery/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Login failed')
      }
      // Only allow active partners
      if (data.deliveryPartner && data.deliveryPartner.status && data.deliveryPartner.status !== 'active') {
        throw new Error('Account inactive. Contact admin.')
      }
      localStorage.setItem('delivery_partner_id', data.deliveryPartner.id)
      setDeliveryPartner(data.deliveryPartner)
      return { success: true }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('delivery_partner_id')
    setDeliveryPartner(null)
  }

  // Removed verifyPassword; password is now checked by backend only

  return (
    <DeliveryPartnerAuthContext.Provider
      value={{
        deliveryPartner,
        loading,
        error,
        login,
        logout,
        isAuthenticated: !!deliveryPartner
      }}
    >
      {children}
    </DeliveryPartnerAuthContext.Provider>
  )
}
