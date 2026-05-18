import { useState } from 'react'

interface Props {
  tenantId: string
  cloudFormationUrl: string
  onNext: (roleArn: string) => void
}

export default function StepDeployRole({ cloudFormationUrl, onNext }: Props) {
  const [roleArn, setRoleArn] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  function copyUrl() {
    navigator.clipboard.writeText(cloudFormationUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const arnRegex = /^arn:aws:iam::\d{12}:role\/.+$/
    if (!arnRegex.test(roleArn.trim())) {
      setError('Invalid Role ARN format. Expected: arn:aws:iam::123456789012:role/RoleName')
      return
    }
    setError('')
    onNext(roleArn.trim())
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Deploy IAM role</h2>
        <p className="mt-1 text-sm text-gray-400">
          We need read-only access to your AWS account. Click below to deploy a CloudFormation stack that creates the role.
        </p>
      </div>

      <ol className="space-y-3 text-sm text-gray-300">
        {[
          'Click "Launch Stack" below — your AWS console will open',
          'Verify the pre-filled parameters and click "Create Stack"',
          'Wait ~30 seconds for the stack to finish (status: CREATE_COMPLETE)',
          'Click the "Outputs" tab in the CloudFormation console',
          'Copy the value next to "RoleArn"',
          'Paste it in the field below and click "Verify Connection"',
        ].map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-medium text-orange-400">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {cloudFormationUrl ? (
        <div className="space-y-2">
          <a
            href={cloudFormationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-orange-500 bg-orange-500/10 px-4 py-2.5 text-sm font-semibold text-orange-400 transition-colors hover:bg-orange-500/20"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Launch Stack in AWS Console
          </a>
          <p className="text-center text-xs text-gray-500">
            If the button doesn't open,{' '}
            <button type="button" onClick={copyUrl} className="text-orange-400 underline hover:text-orange-300">
              {copied ? 'copied!' : 'copy the URL'}
            </button>
            {' '}and paste it in your browser.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-400">
          CloudFormation URL not available. Please contact support.
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">
          Role ARN <span className="text-orange-400">*</span>
        </label>
        <input
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 font-mono text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          placeholder="arn:aws:iam::123456789012:role/ChatbotReadOnly-..."
          value={roleArn}
          onChange={e => setRoleArn(e.target.value)}
          required
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <button
        type="submit"
        disabled={!roleArn.trim()}
        className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Verify Connection
      </button>
    </form>
  )
}
