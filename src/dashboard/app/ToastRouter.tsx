import {useSetAtom} from 'jotai'
import {dashboardAtoms} from '../atoms/dashboard.js'
import {useToastOnChange} from '../hook/UseToastOnChange.js'

export function ToastRouter() {
  const retry = useSetAtom(dashboardAtoms.retryMutationQueue)
  const discard = useSetAtom(dashboardAtoms.discardMutationQueue)

  useToastOnChange(dashboardAtoms.mutationQueue, (prev, next) => {
    if (prev && prev.failed === 0 && next.failed > 0) {
      return {
        type: 'error',
        message: next.error ?? 'Sync failed',
        blocking: true,
        actions: [
          {label: 'Retry', onPress: retry},
          {label: 'Discard', onPress: discard}
        ]
      }
    }
    return null
  })

  return null
}
