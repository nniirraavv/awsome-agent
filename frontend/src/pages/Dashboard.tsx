import { useState } from 'react'
import type { Tenant } from '../types/index.ts'
import { signOut } from '../lib/cognito.ts'

interface Props {
  tenants: Tenant[]
  onOpenChat: (tenant: Tenant) => void
  onAddAccount: () => void
  onResumeSetup: (tenant: Tenant) => void
  onDeleteTenant: (tenant: Tenant) => Promise<void>
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

export default function Dashboard({ tenants, onOpenChat, onAddAccount, onResumeSetup, onDeleteTenant, onSignOut }: Props) {
  const [confirmDelete, setConfirmDelete] = useState<Tenant | null>(null)
  const [deleting, setDeleting] = useState(false)

  function handleSignOut() {
    signOut()
    onSignOut()
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await onDeleteTenant(confirmDelete)
    } finally {
      setDeleting(false)
      setConfirmDelete(null)
    }
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
                {/* Status badge + delete */}
                <div className="mb-4 flex items-start justify-between">
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColors[tenant.status] ?? 'bg-gray-700 text-gray-300'}`}>
                    {statusLabels[tenant.status] ?? tenant.status}
                  </span>
                  <button
                    onClick={() => setConfirmDelete(tenant)}
                    className="rounded p-1 text-gray-600 transition hover:bg-red-500/10 hover:text-red-400"
                    title="Delete account"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
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

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
            <h3 className="mb-2 text-base font-semibold text-white">Delete AWS Account?</h3>
            <p className="mb-1 text-sm text-gray-400">
              This will permanently remove <span className="font-medium text-white">{confirmDelete.companyName}</span> from your profile.
            </p>
            <p className="mb-6 font-mono text-xs text-gray-500">{confirmDelete.awsAccountId}</p>
            <p className="mb-6 text-xs text-gray-500">
              All data will be deleted. You can reconnect the same account afterwards.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
