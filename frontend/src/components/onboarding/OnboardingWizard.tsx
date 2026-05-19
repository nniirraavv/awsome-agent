import { useState } from 'react'
import type { Tenant, OnboardingState } from '../../types/index.ts'
import StepRegister from './StepRegister.tsx'
import StepDeployRole from './StepDeployRole.tsx'
import StepVerify from './StepVerify.tsx'
import { signOut } from '../../lib/cognito.ts'

interface Props {
  initialTenantId?: string
  initialCloudFormationUrl?: string
  onComplete: (tenant: Tenant) => void
  onCancel?: () => void
}

export default function OnboardingWizard({ initialTenantId, initialCloudFormationUrl, onComplete, onCancel }: Props) {
  const [state, setState] = useState<OnboardingState>({
    step: initialTenantId ? 2 : 1,
    tenantId: initialTenantId,
    cloudFormationUrl: initialCloudFormationUrl,
  })

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4">
      <div className="absolute right-4 top-4 flex gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-400 transition hover:border-gray-600 hover:text-white"
          >
            Cancel
          </button>
        )}
        <button
          onClick={() => { signOut(); window.location.reload() }}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-400 transition hover:border-gray-600 hover:text-white"
        >
          Sign out
        </button>
      </div>
      <div className="w-full max-w-lg">
        {/* Logo / header */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10">
            <svg className="h-7 w-7 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white">AWS DevOps Assistant</h1>
          <p className="mt-1 text-sm text-gray-400">Connect your AWS account to get started</p>
        </div>

        {/* Step indicators */}
        <div className="mb-8 flex items-center justify-center gap-3">
          {([1, 2, 3] as const).map(n => (
            <div key={n} className="flex items-center gap-3">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                state.step === n
                  ? 'bg-orange-500 text-white'
                  : state.step > n
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-500'
              }`}>
                {state.step > n ? '✓' : n}
              </div>
              {n < 3 && <div className={`h-px w-12 ${state.step > n ? 'bg-green-600' : 'bg-gray-800'}`} />}
            </div>
          ))}
        </div>

        {/* Steps */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8">
          {state.step === 1 && (
            <StepRegister
              onNext={(tenantId, externalId, cloudFormationUrl) =>
                setState({ step: 2, tenantId, externalId, cloudFormationUrl })
              }
            />
          )}
          {state.step === 2 && (
            <StepDeployRole
              tenantId={state.tenantId!}
              cloudFormationUrl={state.cloudFormationUrl!}
              onNext={(roleArn) => setState(s => ({ ...s, step: 3, roleArn }))}
            />
          )}
          {state.step === 3 && (
            <StepVerify
              tenantId={state.tenantId!}
              roleArn={state.roleArn!}
              onComplete={onComplete}
              onBack={() => setState(s => ({ ...s, step: 2 }))}
            />
          )}
        </div>
      </div>
    </div>
  )
}
