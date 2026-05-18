import { useState } from 'react'
import { signIn, signUp, confirmSignUp, resendConfirmationCode } from '../lib/cognito.ts'

type Mode = 'login' | 'signup' | 'confirm'

interface Props {
  onAuthenticated: () => void
}

export default function AuthPage({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmCode, setConfirmCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function friendlyError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('UserNotFoundException') || msg.includes('User does not exist')) return 'No account found with this email.'
    if (msg.includes('NotAuthorizedException')) return 'Incorrect email or password.'
    if (msg.includes('UsernameExistsException') || msg.includes('already exists')) return 'An account with this email already exists. Please sign in.'
    if (msg.includes('InvalidPasswordException') || msg.includes('password')) return 'Password must be at least 8 characters with uppercase, lowercase, and numbers.'
    if (msg.includes('CodeMismatchException') || msg.includes('Invalid verification code')) return 'Incorrect code. Please check your email and try again.'
    if (msg.includes('ExpiredCodeException')) return 'Code expired. Click "Resend code" to get a new one.'
    if (msg.includes('LimitExceededException')) return 'Too many attempts. Please wait a few minutes and try again.'
    return msg
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      await signIn(email, password)
      onAuthenticated()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('UserNotConfirmedException') || msg.includes('not confirmed')) {
        setMode('confirm')
        setError(null)
        setInfo('Your account is not confirmed yet. Enter the code we sent to your email.')
      } else {
        setError(friendlyError(err))
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      await signUp(email, password)
      setMode('confirm')
      setInfo(`We sent a 6-digit code to ${email}. Enter it below.`)
    } catch (err: unknown) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      await confirmSignUp(email, confirmCode.trim())
      setInfo('Email confirmed! Signing you in…')
      await signIn(email, password)
      onAuthenticated()
    } catch (err: unknown) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setError(null)
    setInfo(null)
    try {
      await resendConfirmationCode(email)
      setInfo('A new code has been sent to your email.')
    } catch (err: unknown) {
      setError(friendlyError(err))
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-950">
      <div className="w-full max-w-md px-4">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center justify-center rounded-xl bg-orange-500/10 p-3">
            <svg className="h-8 w-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">AWS DevOps Assistant</h1>
          <p className="mt-1 text-sm text-gray-400">
            {mode === 'login' && 'Sign in to your account'}
            {mode === 'signup' && 'Create a new account'}
            {mode === 'confirm' && 'Verify your email'}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-xl">
          {error && (
            <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-300">
              {info}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder="you@example.com" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">Password</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder="••••••••" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50">
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder="you@example.com" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">Password</label>
                <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder="Min 8 characters" />
                <p className="mt-1 text-xs text-gray-500">Must include uppercase, lowercase, and a number.</p>
              </div>
              <button type="submit" disabled={loading}
                className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50">
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}

          {mode === 'confirm' && (
            <form onSubmit={handleConfirm} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">Verification code</label>
                <input type="text" required value={confirmCode} onChange={e => setConfirmCode(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-center text-lg font-mono tracking-widest text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder="123456" maxLength={6} autoComplete="one-time-code" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50">
                {loading ? 'Verifying…' : 'Verify & sign in'}
              </button>
              <button type="button" onClick={handleResend}
                className="w-full rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 transition hover:border-gray-600 hover:text-white">
                Resend code
              </button>
            </form>
          )}

          {mode !== 'confirm' && (
            <div className="mt-6 border-t border-gray-800 pt-5 text-center text-sm text-gray-400">
              {mode === 'login' ? (
                <>Don't have an account?{' '}
                  <button onClick={() => { setMode('signup'); setError(null); setInfo(null) }}
                    className="font-medium text-orange-400 hover:text-orange-300">Sign up</button>
                </>
              ) : (
                <>Already have an account?{' '}
                  <button onClick={() => { setMode('login'); setError(null); setInfo(null) }}
                    className="font-medium text-orange-400 hover:text-orange-300">Sign in</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
