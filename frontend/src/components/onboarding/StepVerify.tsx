import { useEffect, useState } from 'react'
import type { Tenant, VerifyRoleResponse } from '../../types/index.ts'

const API = import.meta.env.VITE_API_HTTP_URL ?? ''

interface Props {
  tenantId: string
  roleArn: string
  onComplete: (tenant: Tenant) => void
  onBack: () => void
}

export default function StepVerify({ tenantId, roleArn, onComplete, onBack }: Props) {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [error, setError] = useState('')
  const [detectedServices, setDetectedServices] = useState<string[]>([])

  useEffect(() => {
    verify()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function verify() {
    setStatus('verifying')
    setError('')
    try {
      const res = await fetch(`${API}/onboarding/verify-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, roleArn }),
      })
      const data = await res.json() as VerifyRoleResponse
      if (!data.success) {
        setStatus('error')
        setError((data as { success: false; error: string }).error)
        return
      }
      setDetectedServices(data.detectedServices)
      setStatus('success')
      // Brief pause to show success state
      setTimeout(() => {
        onComplete({
          tenantId,
          companyName: '',
          email: '',
          awsAccountId: '',
          status: 'active',
          detectedServices: data.detectedServices,
          activeMcpServers: data.activeMcpServers,
          lastDiscoveryAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        })
      }, 1500)
    } catch (err) {
      setStatus('error')
      setError(String(err))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Verifying connection</h2>
        <p className="mt-1 text-sm text-gray-400">Testing access to your AWS account…</p>
      </div>

      {status === 'verifying' && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Assuming IAM role and scanning services…</p>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-green-950 px-4 py-3">
            <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-green-400">Connection verified successfully</span>
          </div>
          {detectedServices.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-400">Detected {detectedServices.length} AWS services:</p>
              <div className="flex flex-wrap gap-2">
                {detectedServices.map(s => (
                  <span key={s} className="rounded-md bg-gray-800 px-2 py-1 text-xs font-mono text-orange-300">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="text-sm text-gray-500">Redirecting to chat…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4">
          <div className="rounded-lg bg-red-950 px-4 py-3">
            <p className="text-sm font-medium text-red-400">Verification failed</p>
            <p className="mt-1 text-sm text-red-300">{error}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="flex-1 rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-800"
            >
              Back
            </button>
            <button
              onClick={verify}
              className="flex-1 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
