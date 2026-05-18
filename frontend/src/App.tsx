import { useEffect, useState } from 'react'
import type { Tenant } from './types/index.ts'
import OnboardingWizard from './components/onboarding/OnboardingWizard.tsx'
import ChatWindow from './components/ChatWindow.tsx'

const API = import.meta.env.VITE_API_HTTP_URL ?? ''

export default function App() {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [tenantId, setTenantId] = useState<string | null>(
    () => localStorage.getItem('tenantId')
  )

  useEffect(() => {
    if (!tenantId) {
      setLoading(false)
      return
    }
    fetch(`${API}/tenant/me`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: Tenant | null) => {
        setTenant(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [tenantId])

  function handleOnboardingComplete(t: Tenant) {
    localStorage.setItem('tenantId', t.tenantId)
    setTenantId(t.tenantId)
    setTenant(t)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    )
  }

  if (!tenant || tenant.status === 'pending_role_setup') {
    return (
      <OnboardingWizard
        initialTenantId={tenantId ?? undefined}
        onComplete={handleOnboardingComplete}
      />
    )
  }

  return <ChatWindow tenant={tenant} onTenantUpdate={setTenant} />
}
