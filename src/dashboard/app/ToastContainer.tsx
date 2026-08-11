import {useState} from 'react'
import {Button} from '#/components.js'
import {useToast} from '../hooks.js'
import {IcRoundClose} from '../icons.js'
import {slugify} from '#/core/util/Slugs.js'
import {ToastRouter} from './ToastRouter.js'
import type {DashboardToastType} from '../atoms/dashboard.js'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from './ui/DashboardModal.js'

const toastTitles: Record<DashboardToastType, string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
  success: 'Success'
}

export function ToastContainer() {
  const {toasts, dismiss} = useToast()
  const nonBlockingToasts = toasts.filter(toast => !toast.blocking)

  return (
    <>
      {nonBlockingToasts.map(toast => (
        <div key={toast.id}>
          <div>{toast.message}</div>
          <Button onPress={() => dismiss(toast.id)} icon={IcRoundClose} />
        </div>
      ))}
    </>
  )
}

export function Toast() {
  return (
    <>
      <ToastRouter />
      <ToastContainer />
      <BlockingToast />
    </>
  )
}

export function BlockingToast() {
  const {toasts, dismiss} = useToast()
  const toast = toasts.find(toast => toast.blocking)
  const [retryState, setRetryState] = useState<'idle' | 'pending' | 'failed'>(
    'idle'
  )
  if (toast == null) return null

  const retryAction = toast.actions?.find(a => a.label === 'Retry')
  const discardAction = toast.actions?.find(a => a.label === 'Discard')

  return (
    <DashboardModal isOpen isDismissable={false} isKeyboardDismissDisabled>
      <DashboardModalDialog label={toastTitles[toast.type]} closeButton={false}>
        <DashboardModalContent>
          <p>{toast.message}</p>
        </DashboardModalContent>
        <DashboardModalFooter>
          {discardAction && (
            <Button
              appearance="outline"
              onPress={() => {
                discardAction.onPress()
                dismiss(toast.id)
              }}
            >
              {discardAction.label}
            </Button>
          )}
          {retryAction && (
            <Button
              isPending={retryState === 'pending'}
              isDisabled={retryState === 'pending'}
              intent={retryState === 'failed' ? 'danger' : 'primary'}
              onPress={async () => {
                const start = Date.now()
                setRetryState('pending')
                try {
                  await retryAction.onPress()
                  dismiss(toast.id)
                } catch {
                  const elapsed = Date.now() - start
                  if (elapsed < 500) {
                    await new Promise(r => setTimeout(r, 500 - elapsed))
                  }
                  setRetryState('failed')
                  setTimeout(() => setRetryState('idle'), 2000)
                }
              }}
            >
              {retryState === 'failed' ? 'Failed' : 'Retry'}
            </Button>
          )}
          {!retryAction &&
            !discardAction &&
            toast.actions?.map(action => (
              <Button
                key={slugify(action.label)}
                onPress={() => action.onPress()}
              >
                {action.label}
              </Button>
            ))}
        </DashboardModalFooter>
      </DashboardModalDialog>
    </DashboardModal>
  )
}
