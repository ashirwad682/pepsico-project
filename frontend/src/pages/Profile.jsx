import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { motion } from 'framer-motion';
import { useMediaQuery } from '../lib/useMediaQuery';

// ...existing code...
const API_BASE = import.meta.env.VITE_API_BASE 
  ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') 
  : (import.meta.env.PROD ? 'https://pepsico-backend.vercel.app' : 'http://localhost:5001')
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const ALLOWED_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png'])
const ALLOWED_DOCUMENT_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'])

const REQUIRED_DOCUMENTS = [
  { documentType: 'aadhaar', documentName: 'Aadhaar Card' },
  { documentType: 'pan', documentName: 'PAN Card' },
  { documentType: 'gst_certificate', documentName: 'GST Certificate' }
]

const VERIFICATION_STATUS_STYLES = {
  'Pending Verification': {
    icon: '🔴',
    label: 'Pending Verification',
    background: '#fef2f2',
    color: '#991b1b',
    border: '#fecaca'
  },
  'Under Review': {
    icon: '🟡',
    label: 'Under Review',
    background: '#fef9c3',
    color: '#854d0e',
    border: '#fde68a'
  },
  Verified: {
    icon: '🟢',
    label: 'Verified',
    background: '#ecfdf5',
    color: '#065f46',
    border: '#a7f3d0'
  }
}

const FORMAT_DATE = new Intl.DateTimeFormat('en-IN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})

const FORMAT_DATETIME = new Intl.DateTimeFormat('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

function truncateEmail(value) {
  if (!value) return '—'
  if (value.length <= 24) return value
  const [local, domain = ''] = value.split('@')
  return `${local.slice(0, 12)}…@${domain}`
}

function formatPhone(value) {
  if (!value) return 'Add a contact number'
  const clean = value.replace(/\D/g, '')
  if (clean.length === 10) return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`
  if (clean.length === 12 && clean.startsWith('91')) return `+${clean.slice(0, 2)} ${clean.slice(2, 7)} ${clean.slice(7)}`
  return value
}

function getVerificationStatusStyle(value) {
  return VERIFICATION_STATUS_STYLES[value] || VERIFICATION_STATUS_STYLES['Pending Verification']
}

function formatFileSize(sizeBytes) {
  const size = Number(sizeBytes || 0)
  if (!Number.isFinite(size) || size <= 0) return '—'
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${size} B`
}

export default function Profile() {

  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 900px)')
  const [authUser, setAuthUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [addressError, setAddressError] = useState('');
  const [documents, setDocuments] = useState([])
  const [verificationStatus, setVerificationStatus] = useState('Pending Verification')
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [documentsError, setDocumentsError] = useState('')
  const [documentActionMessage, setDocumentActionMessage] = useState('')
  const [uploadingDocumentType, setUploadingDocumentType] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [photoMessage, setPhotoMessage] = useState('')
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const cameraStreamRef = useRef(null)

  function stopCameraStream() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  useEffect(() => {
    return () => {
      stopCameraStream()
    }
  }, [])

  const getAuthToken = useCallback(async () => {
    const { data, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError

    const token = data?.session?.access_token
    if (!token) {
      throw new Error('Session expired. Please log in again.')
    }
    return token
  }, [])

  const primaryAddress = useMemo(() => {
    if (!Array.isArray(addresses) || addresses.length === 0) return null;
    return addresses.find((address) => address.is_default) || addresses[0];
  }, [addresses]);

  const documentMap = useMemo(() => {
    const map = new Map()
    for (const doc of documents || []) {
      if (doc?.document_type) {
        map.set(doc.document_type, doc)
      }
    }
    return map
  }, [documents])

  const loadVerificationData = useCallback(async () => {
    setDocumentsLoading(true)
    setDocumentsError('')

    try {
      const token = await getAuthToken()
      const response = await fetch(`${API_BASE}/api/user/verification-documents`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load verification documents')
      }

      setDocuments(Array.isArray(payload.documents) ? payload.documents : [])
      setVerificationStatus(payload.verification_status || 'Pending Verification')
      if (typeof payload.user_is_verified === 'boolean') {
        setProfile((prev) => prev ? { ...prev, is_verified: payload.user_is_verified } : prev)
      }
    } catch (err) {
      setDocuments([])
      setVerificationStatus('Pending Verification')
      setDocumentsError(err.message || 'Unable to load verification documents')
    } finally {
      setDocumentsLoading(false)
    }
  }, [getAuthToken])

  const loadProfile = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const { data: authResult, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authResult?.user;
      setAuthUser(user);
      if (!user) {
        setProfile(null);
        setAddresses([]);
        setDocuments([])
        setVerificationStatus('Pending Verification')
        setLoading(false);
        return;
      }
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      if (profileError) throw profileError;
      setProfile(profileData);
      const { data: addressData, error: addressError } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });
      if (addressError) throw addressError;
      setAddresses(addressData || []);
      await loadVerificationData()
    } catch (err) {
      setError(err.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, [loadVerificationData]);

  const uploadPhotoFile = useCallback(async (selectedFile, source = 'upload') => {
    if (!selectedFile) return false

    if (!ALLOWED_PHOTO_MIME_TYPES.has(selectedFile.type)) {
      setPhotoError('Only JPG and PNG files are allowed for profile photos.')
      setPhotoMessage('')
      return false
    }

    if (selectedFile.size > MAX_UPLOAD_BYTES) {
      setPhotoError('Profile photo must be 5MB or smaller.')
      setPhotoMessage('')
      return false
    }

    setPhotoUploading(true)
    setPhotoError('')
    setPhotoMessage('')

    try {
      const token = await getAuthToken()
      const formData = new FormData()
      formData.append('photo', selectedFile)
      formData.append('source', source)

      const response = await fetch(`${API_BASE}/api/user/profile-photo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to upload profile photo')
      }

      setProfile((prev) => prev ? {
        ...prev,
        profile_photo_url: payload.profile_photo_url || prev.profile_photo_url,
        profile_photo_source: payload.profile_photo_source || source
      } : prev)

      setPhotoMessage('Profile photo updated successfully.')
      return true
    } catch (err) {
      setPhotoError(err.message || 'Unable to upload profile photo')
      return false
    } finally {
      setPhotoUploading(false)
    }
  }, [getAuthToken])

  async function openLiveCamera() {
    setPhotoError('')
    setPhotoMessage('')

    if (!navigator?.mediaDevices?.getUserMedia) {
      setPhotoError('Live camera is not supported on this device/browser.')
      return
    }

    setCameraOpen(true)
    setCameraStarting(true)
    stopCameraStream()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      })

      cameraStreamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
    } catch (err) {
      const text = String(err?.message || '')
      if (text.toLowerCase().includes('permission') || text.toLowerCase().includes('notallowed')) {
        setPhotoError('Camera access denied. Please allow camera permission and try again.')
      } else {
        setPhotoError('Unable to start live camera. Please check camera settings and retry.')
      }
      setCameraOpen(false)
      stopCameraStream()
    } finally {
      setCameraStarting(false)
    }
  }

  function closeLiveCamera() {
    stopCameraStream()
    setCameraOpen(false)
  }

  async function captureLivePhoto() {
    if (photoUploading) return

    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas) {
      setPhotoError('Camera preview is not ready yet.')
      return
    }

    const width = Number(video.videoWidth || 0)
    const height = Number(video.videoHeight || 0)
    if (width <= 0 || height <= 0) {
      setPhotoError('Camera is still loading. Please wait a moment and try again.')
      return
    }

    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      setPhotoError('Unable to capture live photo.')
      return
    }

    context.drawImage(video, 0, 0, width, height)

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    })

    if (!blob) {
      setPhotoError('Unable to capture photo from camera.')
      return
    }

    const liveFile = new File([blob], `user-live-photo-${Date.now()}.jpg`, {
      type: 'image/jpeg'
    })

    const success = await uploadPhotoFile(liveFile, 'camera')
    if (success) {
      closeLiveCamera()
    }
  }

  const handleDocumentUpload = useCallback(async (event, documentType) => {
    const selectedFile = event?.target?.files?.[0]
    event.target.value = ''

    if (!selectedFile) return

    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(selectedFile.type)) {
      setDocumentsError('Only PDF, JPG, and PNG files are allowed.')
      setDocumentActionMessage('')
      return
    }

    if (selectedFile.size > MAX_UPLOAD_BYTES) {
      setDocumentsError('Document size must be 5MB or smaller.')
      setDocumentActionMessage('')
      return
    }

    setUploadingDocumentType(documentType)
    setDocumentsError('')
    setDocumentActionMessage('')

    try {
      const token = await getAuthToken()
      const formData = new FormData()
      formData.append('document', selectedFile)

      const response = await fetch(`${API_BASE}/api/user/verification-documents/${documentType}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to upload document')
      }

      if (Array.isArray(payload.documents)) {
        setDocuments(payload.documents)
      }
      setVerificationStatus(payload.verification_status || 'Under Review')
      if (typeof payload.user_is_verified === 'boolean') {
        setProfile((prev) => prev ? { ...prev, is_verified: payload.user_is_verified } : prev)
      }
      setDocumentActionMessage(payload.message || 'Document uploaded successfully.')
    } catch (err) {
      setDocumentsError(err.message || 'Unable to upload document')
    } finally {
      setUploadingDocumentType('')
    }
  }, [getAuthToken])

  useEffect(() => {
    loadProfile(false)
  }, [loadProfile]);

  // Show loading spinner while checking auth or loading profile
  if (authUser === undefined || loading) {
    return (
      <div style={{ minHeight: '400px', display: 'grid', placeItems: 'center' }}>
        <div style={{ display: 'grid', gap: 16, placeItems: 'center' }}>
          <div style={{ width: 48, height: 48, border: '3px solid #e2e8f0', borderTop: '3px solid #1d4ed8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
          <div style={{ color: '#64748b', fontSize: 14, fontWeight: 500 }}>Loading profile</div>
        </div>
        <style>{
          `@keyframes spin { to { transform: rotate(360deg); } }`
        }</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 480, margin: '40px auto', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 16, padding: 24, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#991b1b' }}>Unable to load profile</div>
        <div style={{ color: '#b91c1c', fontSize: 13, lineHeight: 1.6 }}>{error}</div>
        <button onClick={() => window.location.reload()} style={{ marginTop: 8, padding: '10px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  if (!authUser) {
    navigate('/login', { replace: true });
    return (
      <div style={{ minHeight: '320px', display: 'grid', placeItems: 'center', color: '#64748b', fontSize: 15 }}>
        Redirecting to login…
      </div>
    );
  }

  if (!profile || (typeof profile === 'object' && Object.keys(profile).length === 0)) {
    return (
      <div style={{ maxWidth: 480, margin: '40px auto', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 16, padding: 28, display: 'grid', gap: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#92400e' }}>Profile not found</div>
        <div style={{ color: '#b45309', fontSize: 13, lineHeight: 1.6 }}>No profile data found for your account. Please contact support.</div>
      </div>
    );
  }

  const avatarInitial = (profile.full_name || profile.email || 'A').trim().slice(0, 1).toUpperCase()

  return (
    <div style={{ display: 'grid', gap: 28, gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', maxWidth: 1080, margin: '0 auto', padding: isMobile ? 16 : 32, background: '#f8fafc', minHeight: '100vh' }}>
      <ProfileSidebar
        avatarInitial={avatarInitial}
        profile={profile}
        verificationStatus={verificationStatus}
        refreshing={loading}
        photoUploading={photoUploading}
        photoError={photoError}
        photoMessage={photoMessage}
        onOpenCamera={openLiveCamera}
        onRefresh={() => loadProfile(true)}
      />

      <div style={{ display: 'grid', gap: 24, alignContent: 'start' }}>
        <ProfileDetailsCard profile={profile} />
        <DocumentVerificationSection
          verificationStatus={verificationStatus}
          documents={documentMap}
          loading={documentsLoading}
          error={documentsError}
          actionMessage={documentActionMessage}
          uploadingDocumentType={uploadingDocumentType}
          onUpload={handleDocumentUpload}
        />
        <AddressSection
          primaryAddress={primaryAddress}
          addressError={addressError}
          onRefresh={() => loadProfile(true)}
        />
        <PhoneEditSection profile={profile} onUpdated={() => loadProfile(true)} isMobile={isMobile} />
      </div>

      {cameraOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 1000
          }}
        >
          <div style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 14, border: '1px solid #cbd5e1', padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Live Camera Capture</div>

            <div style={{
              borderRadius: 10,
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              background: '#0f172a',
              aspectRatio: '3 / 4',
              display: 'grid',
              placeItems: 'center'
            }}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            {cameraStarting && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>Starting camera...</div>
            )}

            <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={closeLiveCamera}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#334155',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={captureLivePhoto}
                disabled={cameraStarting || photoUploading}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: 0,
                  background: '#2563eb',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: (cameraStarting || photoUploading) ? 'not-allowed' : 'pointer',
                  opacity: (cameraStarting || photoUploading) ? 0.7 : 1
                }}
              >
                {photoUploading ? 'Uploading...' : 'Take Photo'}
              </button>
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

function ProfileSidebar({
  avatarInitial,
  profile,
  verificationStatus,
  refreshing,
  photoUploading,
  photoError,
  photoMessage,
  onOpenCamera,
  onRefresh
}) {
  const statusStyle = getVerificationStatusStyle(verificationStatus)
  const profilePhotoUrl = profile?.profile_photo_url

  return (
    <section
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 20,
        padding: 24,
        display: 'grid',
        gap: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        height: 'fit-content',
        position: 'sticky',
        top: 32
      }}
    >
      <div style={{ display: 'grid', placeItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            background: profilePhotoUrl ? `url(${profilePhotoUrl}) center/cover no-repeat` : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            fontWeight: 700,
            boxShadow: '0 4px 12px rgba(29,78,216,0.25)',
            border: '4px solid #fff'
          }}
        >
          {!profilePhotoUrl ? avatarInitial : null}
        </div>
        <div style={{ textAlign: 'center', display: 'grid', gap: 4 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>{profile.full_name || 'PepsiCo Partner'}</div>
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{truncateEmail(profile.email)}</div>
        </div>
        <span
          style={{
            padding: '6px 14px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            background: statusStyle.background,
            color: statusStyle.color,
            border: `1px solid ${statusStyle.border}`,
            letterSpacing: 0.3,
            textTransform: 'uppercase'
          }}
        >
          {statusStyle.icon} {statusStyle.label}
        </span>
        <div style={{ width: '100%', display: 'grid', gap: 8 }}>
          <button
            type="button"
            onClick={onOpenCamera}
            disabled={photoUploading}
            style={{
              width: '100%',
              textAlign: 'center',
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #dbeafe',
              background: photoUploading ? '#eff6ff' : '#eff6ff',
              color: '#1d4ed8',
              fontSize: 12,
              fontWeight: 600,
              cursor: photoUploading ? 'not-allowed' : 'pointer'
            }}
          >
            {photoUploading ? 'Please wait...' : 'Capture Live Photo'}
          </button>

          {photoError && (
            <div style={{ fontSize: 11, color: '#b91c1c', textAlign: 'center' }}>{photoError}</div>
          )}
          {photoMessage && (
            <div style={{ fontSize: 11, color: '#166534', textAlign: 'center' }}>{photoMessage}</div>
          )}
        </div>
      </div>
      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Member since</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{profile.created_at ? FORMAT_DATE.format(new Date(profile.created_at)) : '—'}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        style={{
          marginTop: 4,
          padding: '11px 16px',
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          background: refreshing ? '#f9fafb' : '#fff',
          color: '#374151',
          fontWeight: 600,
          fontSize: 13,
          cursor: refreshing ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: refreshing ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
        }}
      >
        {refreshing ? 'Refreshing…' : 'Sync data'}
      </button>
    </section>
  )
}

function ProfileDetailsCard({ profile }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 20, padding: 28, display: 'grid', gap: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>Profile details</h2>
      </div>
      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <DataRow label="Full name" value={profile.full_name || '—'} />
        <DataRow label="Email address" value={profile.email || '—'} />
        <DataRow label="Phone number" value={formatPhone(profile.phone)} />
        <DataRow label="Last updated" value={profile.updated_at ? FORMAT_DATETIME.format(new Date(profile.updated_at)) : '—'} />
      </div>
    </section>
  )
}

function DataRow({ label, value }) {
  return (
    <div style={{ display: 'grid', gap: 7, padding: '12px 0' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: '#111827', wordBreak: 'break-word', lineHeight: 1.5 }}>{value}</span>
    </div>
  )
}

function DocumentVerificationSection({
  verificationStatus,
  documents,
  loading,
  error,
  actionMessage,
  uploadingDocumentType,
  onUpload
}) {
  const statusStyle = getVerificationStatusStyle(verificationStatus)

  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 20, padding: 28, display: 'grid', gap: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>Document verification</h2>
          <span
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              background: statusStyle.background,
              color: statusStyle.color,
              border: `1px solid ${statusStyle.border}`,
              letterSpacing: 0.3,
              textTransform: 'uppercase'
            }}
          >
            {statusStyle.icon} {statusStyle.label}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
          Upload Aadhaar Card, PAN Card, and GST Certificate. Once uploaded, a document is locked until admin rejection.
        </p>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Allowed formats: PDF/JPG/PNG. Maximum size: 5MB per file.</p>
      </div>

      {loading ? (
        <div style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, background: '#f8fafc', color: '#64748b', fontSize: 13 }}>
          Loading document status...
        </div>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', minWidth: 760 }}>
            <HeaderCell>Document Name</HeaderCell>
            <HeaderCell>Upload File</HeaderCell>
            <HeaderCell>Upload Date</HeaderCell>
            <HeaderCell>Status</HeaderCell>
          </div>

          {REQUIRED_DOCUMENTS.map((requiredDocument) => {
            const record = documents?.get?.(requiredDocument.documentType)
            const status = record?.status || 'Pending'
            const canUpload = !record || status === 'Rejected'
            const isUploading = uploadingDocumentType === requiredDocument.documentType
            const uploadInputId = `upload-${requiredDocument.documentType}`

            const statusTone = status === 'Approved'
              ? { bg: '#dcfce7', color: '#166534' }
              : status === 'Rejected'
                ? { bg: '#fee2e2', color: '#991b1b' }
                : { bg: '#fef3c7', color: '#854d0e' }

            return (
              <div
                key={requiredDocument.documentType}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr',
                  borderBottom: '1px solid #f1f5f9',
                  alignItems: 'start',
                  minWidth: 760
                }}
              >
                <BodyCell>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{requiredDocument.documentName}</div>
                  {record?.download_url && (
                    <a href={record.download_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#1d4ed8', textDecoration: 'none' }}>
                      View uploaded file
                    </a>
                  )}
                </BodyCell>

                <BodyCell>
                  <label
                    htmlFor={uploadInputId}
                    style={{
                      display: 'inline-block',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #d1d5db',
                      background: canUpload && !isUploading ? '#fff' : '#f1f5f9',
                      color: canUpload && !isUploading ? '#1f2937' : '#94a3b8',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: canUpload && !isUploading ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {isUploading ? 'Uploading...' : canUpload ? 'Upload file' : 'Locked'}
                  </label>
                  <input
                    id={uploadInputId}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    style={{ display: 'none' }}
                    disabled={!canUpload || isUploading}
                    onChange={(event) => onUpload(event, requiredDocument.documentType)}
                  />
                  {record && !canUpload && status !== 'Rejected' && (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>Locked until admin review.</div>
                  )}
                </BodyCell>

                <BodyCell>
                  <div style={{ color: '#334155', fontSize: 12 }}>
                    {record?.uploaded_at ? FORMAT_DATETIME.format(new Date(record.uploaded_at)) : '—'}
                  </div>
                  {record?.file_size_bytes ? (
                    <div style={{ marginTop: 4, fontSize: 11, color: '#94a3b8' }}>{formatFileSize(record.file_size_bytes)}</div>
                  ) : null}
                </BodyCell>

                <BodyCell>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '5px 10px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      background: statusTone.bg,
                      color: statusTone.color,
                      textTransform: 'uppercase',
                      letterSpacing: 0.2
                    }}
                  >
                    {status}
                  </span>
                  {record?.rejection_reason ? (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#b91c1c' }}>
                      Reason: {record.rejection_reason}
                    </div>
                  ) : null}
                </BodyCell>
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 12, padding: '12px 14px', color: '#991b1b', fontSize: 12, fontWeight: 500 }}>
          {error}
        </div>
      )}

      {actionMessage && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 14px', color: '#166534', fontSize: 12, fontWeight: 500 }}>
          {actionMessage}
        </div>
      )}
    </section>
  )
}

function HeaderCell({ children }) {
  return (
    <div style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {children}
    </div>
  )
}

function BodyCell({ children }) {
  return (
    <div style={{ padding: '12px 14px', display: 'grid', gap: 4 }}>
      {children}
    </div>
  )
}

function AddressSection({ primaryAddress, addressError, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [addressLine, setAddressLine] = useState('');
  const [pincode, setPincode] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formMessage, setFormMessage] = useState('');

  // Lock the form if address exists - user cannot change address once added
  useEffect(() => {
    if (primaryAddress) {
      setShowForm(false);
      setAddressLine('');
      setPincode('');
      setState('');
      setDistrict('');
      setFormError('');
      setFormMessage('');
    }
  }, [primaryAddress]);

  // Auto-fetch state and district when pincode is entered
  useEffect(() => {
    const fetchPincodeData = async () => {
      if (pincode.length === 6) {
        setLookupLoading(true);
        setFormError('');
        try {
          const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
          const data = await response.json();
          
          if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
            const postOffice = data[0].PostOffice[0];
            setState(postOffice.State || '');
            setDistrict(postOffice.District || '');
          } else {
            setFormError('Invalid pincode. Please check and try again.');
            setState('');
            setDistrict('');
          }
        } catch (err) {
          setFormError('Unable to fetch pincode details. Please try again.');
          setState('');
          setDistrict('');
        } finally {
          setLookupLoading(false);
        }
      } else {
        setState('');
        setDistrict('');
      }
    };

    fetchPincodeData();
  }, [pincode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormMessage('');

    // Prevent address submission if address already exists
    if (primaryAddress) {
      setFormError('Address already exists. Contact support to update.');
      setShowForm(false);
      return;
    }

    if (!addressLine.trim()) {
      setFormError('Please enter your address.');
      return;
    }
    if (pincode.length !== 6) {
      setFormError('Please enter a valid 6-digit pincode.');
      return;
    }
    if (!state || !district) {
      setFormError('State and district are required. Please enter a valid pincode.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: insertError } = await supabase
        .from('addresses')
        .insert({
          user_id: user.id,
          address_line: addressLine.trim(),
          pincode: pincode,
          district: district,
          state: state,
          is_default: true
        });

      if (insertError) throw insertError;

      setFormMessage('Address added successfully!');
      setShowForm(false);
      setAddressLine('');
      setPincode('');
      setState('');
      setDistrict('');
      
      if (onRefresh) onRefresh();
    } catch (err) {
      setFormError(err.message || 'Failed to add address.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 20, padding: 28, display: 'grid', gap: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>Delivery address</h2>
      </div>

      {primaryAddress && (
        <div style={{ background: '#fef9e7', border: '1px solid #fde68a', borderRadius: 14, padding: '14px 16px', display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🔒</span>
            <span>Address locked</span>
          </div>
          <div style={{ color: '#b45309', fontSize: 12, lineHeight: 1.6 }}>Your delivery address cannot be modified once added. For any changes, please contact support.</div>
        </div>
      )}

      {addressError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 14, padding: '14px 16px', color: '#991b1b', fontSize: 13, fontWeight: 500 }}>
          {addressError}
        </div>
      )}

      {!addressError && primaryAddress && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: 20, display: 'grid', gap: 12, background: '#fafbfc' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>Primary address</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#065f46', background: '#d1fae5', borderRadius: 999, padding: '5px 11px', letterSpacing: 0.3, textTransform: 'uppercase' }}>✓ Verified</span>
          </div>
          <div style={{ fontSize: 14, color: '#111827', fontWeight: 600, lineHeight: 1.5 }}>{primaryAddress.address_line || '—'}</div>
          <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{primaryAddress.district || '—'}</div>
          <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{primaryAddress.state || '—'} {primaryAddress.pincode || ''}</div>
          <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>India</div>
        </div>
      )}

      {!addressError && !primaryAddress && !showForm && (
        <div style={{ border: '1px dashed #d1d5db', borderRadius: 16, padding: 24, display: 'grid', gap: 16, textAlign: 'center', background: '#fafbfc' }}>
          <div style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>No address on file. Please add your delivery address to complete your profile.</div>
          <button
            type="button"
            onClick={() => {
              // Only allow form to open if no address exists
              if (!primaryAddress) {
                setShowForm(true);
              }
            }}
            style={{ padding: '12px 20px', borderRadius: 12, background: '#1d4ed8', color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer', margin: '0 auto' }}
          >
            Add delivery address
          </button>
        </div>
      )}

      {!addressError && !primaryAddress && showForm && (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Address line <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              placeholder="Enter your complete address (Shop/Building, Street, Area)"
              rows={3}
              style={{ padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 12, fontSize: 14, fontWeight: 500, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Pincode <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit pincode"
                maxLength={6}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 12, fontSize: 14, fontWeight: 500, outline: 'none' }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
              {lookupLoading && (
                <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#3b82f6' }}>
                  Looking up...
                </div>
              )}
            </div>
            <span style={{ fontSize: 11, color: '#9ca3b8', fontWeight: 500 }}>State and district will be automatically filled</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>State</label>
              <input
                type="text"
                value={state}
                readOnly
                placeholder="Auto-filled from pincode"
                style={{ padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 14, fontWeight: 500, background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }}
              />
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>District</label>
              <input
                type="text"
                value={district}
                readOnly
                placeholder="Auto-filled from pincode"
                style={{ padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 14, fontWeight: 500, background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }}
              />
            </div>
          </div>

          {formError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 12, padding: '12px 14px', color: '#991b1b', fontSize: 12, fontWeight: 500 }}>
              {formError}
            </div>
          )}

          {formMessage && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 14px', color: '#166534', fontSize: 12, fontWeight: 500 }}>
              {formMessage}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setAddressLine('');
                setPincode('');
                setState('');
                setDistrict('');
                setFormError('');
              }}
              style={{ padding: '12px 20px', borderRadius: 12, background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 13, border: '1px solid #d1d5db', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || lookupLoading}
              style={{ padding: '12px 24px', borderRadius: 12, background: saving ? '#9ca3af' : '#1d4ed8', color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              {saving ? 'Saving...' : 'Save address'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

// PhoneEditSection: Allows editing the user's phone number
function PhoneEditSection({ profile, onUpdated, isMobile }) {
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setPhone(profile?.phone || '');
  }, [profile]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const clean = phone.replace(/\D/g, '');
    if (clean.length !== 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ phone: clean })
        .eq('id', profile.id);
      if (updateError) throw updateError;
      setMessage('Phone number updated successfully!');
      if (onUpdated) onUpdated();
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to update phone number.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 20, padding: 28, display: 'grid', gap: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>Update contact number</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>Change your phone number for order notifications</p>
      </div>
      <form onSubmit={handleSave} style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Phone number</label>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto', gap: 12 }}>
            <input
              type="tel"
              value={phone}
              onChange={e => {
                // Only allow digits, max 10
                let val = e.target.value.replace(/\D/g, '').slice(0, 10);
                setPhone(val);
              }}
              placeholder="Enter 10-digit number"
              maxLength={10}
              style={{ padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 12, fontSize: 14, fontWeight: 500, outline: 'none', transition: 'border 0.15s ease' }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
            <button
              type="submit"
              disabled={saving}
              style={{ padding: '12px 20px', borderRadius: 12, background: saving ? '#9ca3af' : '#1d4ed8', color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s ease', boxShadow: saving ? 'none' : '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              {saving ? 'Updating…' : 'Update number'}
            </button>
          </div>
          <span style={{ fontSize: 11, color: '#9ca3b8', fontWeight: 500 }}>You will receive an OTP to verify the new number</span>
        </div>
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 12, padding: '12px 14px', color: '#991b1b', fontSize: 12, fontWeight: 500 }}>
            {error}
          </div>
        )}
        {message && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 14px', color: '#166534', fontSize: 12, fontWeight: 500 }}>
            {message}
          </div>
        )}
      </form>
    </section>
  );
}

function PasswordManager() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage('All fields are required.')
      return
    }

    if (newPassword.length < 6) {
      setMessage('New password must have at least 6 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage('New passwords do not match.')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setMessage('Current password is incorrect.')
        } else {
          setMessage(error.message)
        }
        return
      }

      setMessage('Password updated successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage(err.message || 'Unable to update password right now.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.section
      whileHover={{ y: -2 }}
      style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24, display: 'grid', gap: 18, boxShadow: '0 8px 24px rgba(15,23,42,0.06)' }}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Security</h2>
        <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Change your password regularly to keep your account secure.</p>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Current password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Enter current password"
            style={{ padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 12, fontSize: 14, fontFamily: 'inherit' }}
          />
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="At least 6 characters"
            style={{ padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 12, fontSize: 14, fontFamily: 'inherit' }}
          />
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Re-enter new password"
            style={{ padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 12, fontSize: 14, fontFamily: 'inherit' }}
          />
        </div>
        {message && (
          <div style={{ background: '#f1f5f9', borderRadius: 10, padding: '10px 12px', color: '#1f2937', fontSize: 12 }}>
            {message}
          </div>
        )}
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid #1d4ed8',
            background: saving ? '#93c5fd' : '#1d4ed8',
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.8 : 1
          }}
        >
          {saving ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </motion.section>
  )
}
