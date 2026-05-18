import type { Tenant } from '../types/index.ts'
import ServiceBadges from './ServiceBadges.tsx'

const API = import.meta.env.VITE_API_HTTP_URL ?? ''

interface Props {
  tenant: Tenant
  sessions: string[]
  currentSessionId: string
  onSelectSession: (id: string) => void
  onNewSession: () => void
  onRescan: () => void
}

export default function Sidebar({
  tenant,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onRescan,
}: Props) {
  async function handleRescan() {
    try {
      await fetch(`${API}/onboarding/rescan`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
      })
      onRescan()
    } catch { /* ignore */ }
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-gray-800 bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/20">
          <svg className="h-4 w-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{tenant.companyName || 'AWS Assistant'}</p>
          <p className="font-mono text-xs text-gray-500">{tenant.awsAccountId}</p>
        </div>
      </div>

      {/* New chat button */}
      <div className="px-3 py-3">
        <button
          onClick={onNewSession}
          className="flex w-full items-center gap-2 rounded-lg bg-orange-500/10 px-3 py-2 text-sm font-medium text-orange-400 transition-colors hover:bg-orange-500/20"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New chat
        </button>
      </div>

      {/* Sessions list */}
      {sessions.length > 0 && (
        <div className="flex-1 overflow-y-auto px-3">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-gray-500">History</p>
          <div className="space-y-1">
            {sessions.map(id => (
              <button
                key={id}
                onClick={() => onSelectSession(id)}
                className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  id === currentSessionId
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                Session {id.slice(0, 8)}…
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto border-t border-gray-800 py-3">
        <ServiceBadges services={tenant.detectedServices} />
        <div className="mt-2 px-3">
          <button
            onClick={handleRescan}
            className="w-full rounded-lg px-3 py-2 text-left text-xs text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
          >
            Rescan my account
          </button>
        </div>
      </div>
    </aside>
  )
}
