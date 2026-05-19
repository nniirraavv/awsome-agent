import type { Tenant } from '../types/index.ts'
import { signOut } from '../lib/cognito.ts'

interface Props {
  tenants: Tenant[]
  onOpenChat: (tenant: Tenant) => void
  onAddAccount: () => void
  onResumeSetup: (tenant: Tenant) => void
  onSignOut: () => void
}

const statusColors: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400 border-green-500/30',
  pending_role_setup: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  suspended: 'bg-red-500/15 text-red-400 border-red-500/30',
}

const statusLabels: Record<string, string> = {
  active: 'Active',
  pending_role_setup: 'Pending setup',
  suspended: 'Suspended',
}

export default function Dashboard({ tenants, onOpenChat, onAddAccount, onResumeSetup, onSignOut }: Props) {
  function handleSignOut() {
    signOut()
    onSignOut()
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-500/10 p-1.5">
              <svg className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <span className="text-lg font-semibold">AWS DevOps Chatbot</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-400 transition hover:border-gray-600 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
            </svg>
            Sign out
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Connected AWS Accounts</h2>
            <p className="mt-1 text-sm text-gray-400">
              {tenants.length} {tenants.length === 1 ? 'account' : 'accounts'} connected
            </p>
          </div>
          <button
            onClick={onAddAccount}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add AWS Account
          </button>
        </div>

        {tenants.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-900/50 py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-800">
              <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" />
              </svg>
            </div>
            <p className="text-gray-400">No AWS accounts connected yet.</p>
            <button
              onClick={onAddAccount}
              className="mt-4 rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              Connect your first account
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tenants.map(tenant => (
              <div
                key={tenant.tenantId}
                className="rounded-2xl border border-gray-800 bg-gray-900 p-6 transition hover:border-gray-700"
              >
                {/* Status badge */}
                <div className="mb-4 flex items-start justify-between">
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColors[tenant.status] ?? 'bg-gray-700 text-gray-300'}`}>
                    {statusLabels[tenant.status] ?? tenant.status}
                  </span>
                </div>

                {/* Account info */}
                <h3 className="mb-1 truncate text-base font-semibold text-white">
                  {tenant.companyName}
                </h3>
                <p className="mb-1 font-mono text-xs text-gray-400">
                  {tenant.awsAccountId}
                </p>
                <p className="mb-4 truncate text-xs text-gray-500">{tenant.email}</p>

                {tenant.detectedServices.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-1">
                    {tenant.detectedServices.slice(0, 4).map(svc => (
                      <span key={svc} className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400">
                        {svc}
                      </span>
                    ))}
                    {tenant.detectedServices.length > 4 && (
                      <span className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-500">
                        +{tenant.detectedServices.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {tenant.status === 'active' ? (
                  <button
                    onClick={() => onOpenChat(tenant)}
                    className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
                  >
                    Open Chat
                  </button>
                ) : (
                  <button
                    onClick={() => onResumeSetup(tenant)}
                    className="w-full rounded-lg border border-orange-500 px-4 py-2 text-sm font-semibold text-orange-400 transition hover:bg-orange-500/10"
                  >
                    Continue Setup
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
