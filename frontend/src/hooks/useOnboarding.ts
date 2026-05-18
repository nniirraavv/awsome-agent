import { useState } from 'react'
import type { OnboardingState } from '../types/index.ts'

export function useOnboarding(initialTenantId?: string) {
  const [state, setState] = useState<OnboardingState>({
    step: initialTenantId ? 2 : 1,
    tenantId: initialTenantId,
  })

  function advanceToStep2(tenantId: string, externalId: string, cloudFormationUrl: string) {
    setState({ step: 2, tenantId, externalId, cloudFormationUrl })
  }

  function advanceToStep3(roleArn: string) {
    setState(s => ({ ...s, step: 3, roleArn }))
  }

  function backToStep2() {
    setState(s => ({ ...s, step: 2 }))
  }

  return { state, advanceToStep2, advanceToStep3, backToStep2 }
}
