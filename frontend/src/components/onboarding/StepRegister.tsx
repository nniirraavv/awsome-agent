import { useState } from 'react'
import type { RegisterResponse } from '../../types/index.ts'

const API = import.meta.env.VITE_API_HTTP_URL ?? ''

interface Props {
  onNext: (tenantId: string, externalId: string, cloudFormationUrl: string) => void
}

export default function StepRegister({ onNext }: Props) {
  const [form, setForm] = useState({ companyName: '', email: '', awsAccountId: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/onboarding/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json() as RegisterResponse & { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Registration failed')
      localStorage.setItem('tenantId', data.tenantId)
      onNext(data.tenantId, data.externalId, data.cloudFormationUrl)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Create your account</h2>
        <p className="mt-1 text-sm text-gray-400">We'll set up read-only access to your AWS account.</p>
      </div>

      <Field label="Company name" required>
        <input
          className={inputCls}
          placeholder="Acme Corp"
          value={form.companyName}
          onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
          required
        />
      </Field>

      <Field label="Email" required>
        <input
          type="email"
          className={inputCls}
          placeholder="you@company.com"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          required
        />
      </Field>

      <Field label="AWS Account ID" required hint="12-digit number, e.g. 123456789012">
        <input
          className={inputCls}
          placeholder="123456789012"
          pattern="\d{12}"
          maxLength={12}
          value={form.awsAccountId}
          onChange={e => setForm(f => ({ ...f, awsAccountId: e.target.value.replace(/\D/g, '') }))}
          required
        />
      </Field>

      {error && <p className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-400">{error}</p>}

      <button type="submit" disabled={loading} className={btnCls}>
        {loading ? 'Creating account…' : 'Continue'}
      </button>
    </form>
  )
}

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-300">
        {label}{required && <span className="ml-1 text-orange-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'
const btnCls = 'w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed'
