import {useSetAtom} from 'jotai'
import {useDashboard} from '#/dashboard/store.js'
import {useToastOnChange} from '../hook/UseToastOnChange.js'

export function ToastRouter() {
  const dashboard = useDashboard()
  const retry = useSetAtom(dashboard.retryMutationQueue)
  const discard = useSetAtom(dashboard.discardMutationQueue)

  useToastOnChange(dashboard.mutationQueue, (prev, next) => {
    if (prev && prev.failed === 0 && next.failed > 0) {
      return {
        type: 'error',
        message: next.error ?? 'Sync failed',
        blocking: true,
        actions: [
          {label: 'Retry', onPress: () => retry()},
          {label: 'Discard', onPress: () => discard()}
        ]
      }
    }
    return null
  })

  return null
}
