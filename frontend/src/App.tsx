import { useEffect, useState } from 'react'
import type { Tenant } from './types/index.ts'
import OnboardingWizard from './components/onboarding/OnboardingWizard.tsx'
import ChatWindow from './components/ChatWindow.tsx'
import AuthPage from './pages/AuthPage.tsx'
import Dashboard from './pages/Dashboard.tsx'
import { getAccessToken } from './lib/cognito.ts'

const API = import.meta.env.VITE_API_HTTP_URL ?? ''

type View =
  | { kind: 'loading' }
  | { kind: 'auth' }
  | { kind: 'onboarding'; canCancel: boolean }
  | { kind: 'dashboard'; tenants: Tenant[] }
  | { kind: 'chat'; tenant: Tenant; tenants: Tenant[] }

export default function App() {
  const [view, setView] = useState<View>({ kind: 'loading' })

  async function loadTenants(): Promise<Tenant[] | null> {
    const token = getAccessToken()
    if (!token) return null
    const res = await fetch(`${API}/tenant/list`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 401 || res.status === 403) return null
    if (!res.ok) return []
    return res.json()
  }

  async function bootstrap() {
    const token = getAccessToken()
    if (!token) {
      setView({ kind: 'auth' })
      return
    }
    try {
      const tenants = await loadTenants()
      if (tenants === null) {
        // Token invalid/expired — clear it and go to login
        localStorage.removeItem('token')
        setView({ kind: 'auth' })
      } else {
        // Always land on dashboard; user can add accounts from there
        setView({ kind: 'dashboard', tenants })
      }
    } catch {
      setView({ kind: 'auth' })
    }
  }

  useEffect(() => {
    bootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleAuthenticated() {
    bootstrap()
  }

  function handleSignOut() {
    setView({ kind: 'auth' })
  }

  function handleOnboardingComplete(t: Tenant) {
    localStorage.setItem('tenantId', t.tenantId)
    loadTenants().then(tenants => {
      setView({ kind: 'dashboard', tenants: tenants ?? [t] })
    }).catch(() => {
      setView({ kind: 'dashboard', tenants: [t] })
    })
  }

  function handleOpenChat(tenant: Tenant) {
    if (view.kind === 'dashboard') {
      setView({ kind: 'chat', tenant, tenants: view.tenants })
    }
  }

  function handleAddAccount() {
    setView({ kind: 'onboarding', canCancel: true })
  }

  function handleTenantUpdate(t: Tenant) {
    if (view.kind === 'chat') {
      setView({ ...view, tenant: t })
    }
  }

  function handleBackToDashboard() {
    loadTenants().then(tenants => {
      if (tenants === null) {
        localStorage.removeItem('token')
        setView({ kind: 'auth' })
      } else {
        setView({ kind: 'dashboard', tenants })
      }
    }).catch(() => {
      if (view.kind === 'chat') {
        setView({ kind: 'dashboard', tenants: view.tenants })
      }
    })
  }

  if (view.kind === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    )
  }

  if (view.kind === 'auth') {
    return <AuthPage onAuthenticated={handleAuthenticated} />
  }

  if (view.kind === 'onboarding') {
    return (
      <OnboardingWizard
        initialTenantId={undefined}
        onComplete={handleOnboardingComplete}
        onCancel={view.canCancel ? handleBackToDashboard : undefined}
      />
    )
  }

  if (view.kind === 'dashboard') {
    return (
      <Dashboard
        tenants={view.tenants}
        onOpenChat={handleOpenChat}
        onAddAccount={handleAddAccount}
        onSignOut={handleSignOut}
      />
    )
  }

  if (view.kind === 'chat') {
    return (
      <div className="relative">
        {/* Back to dashboard button */}
        <div className="absolute left-4 top-4 z-50">
          <button
            onClick={handleBackToDashboard}
            className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-400 shadow transition hover:border-gray-600 hover:text-white"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Dashboard
          </button>
        </div>
        <ChatWindow tenant={view.tenant} onTenantUpdate={handleTenantUpdate} />
      </div>
    )
  }

  return null
}
