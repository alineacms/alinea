import {styler} from '@alinea/styler'
import {useState, type ComponentType} from 'react'
import {Button, Dialog, Modal, Icon} from '#/components.js'
import {useToast} from '#/dashboard/store.js'
import {IcRoundClose, IcRoundCheck, IcRoundWarning} from '#/dashboard/icons.js'
import {slugify} from '#/core/util/Slugs.js'
import {Badge} from './Badge.js'
import type {DashboardToastType} from '#/dashboard/store/Dashboard.js'
import css from './ToastContainer.module.css'

const styles = styler(css)

const toastTitles: Record<DashboardToastType, string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
  success: 'Success'
}

const toastIcons: Record<DashboardToastType, ComponentType> = {
  error: IcRoundWarning,
  warning: IcRoundWarning,
  info: IcRoundWarning,
  success: IcRoundCheck
}

function renderMessage(message: string) {
  const parts = message.split(/(of type \w+)/g)
  return parts.map((part, i) => {
    const match = part.match(/^of type (\w+)$/)
    if (match) {
      return <>of type <Badge size="small" key={i}>{match[1]}</Badge></>
    }
    return <span key={i}>{part}</span>
  })
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

export function BlockingToast() {
  const {toasts, dismiss} = useToast()
  const toast = toasts.find(toast => toast.blocking)
  const [retryState, setRetryState] = useState<'idle' | 'pending' | 'failed'>('idle')
  if (toast == null) return null

  const retryAction = toast.actions?.find(a => a.label === 'Retry')
  const discardAction = toast.actions?.find(a => a.label === 'Discard')

  return (
    <Modal isOpen isDismissable={false} isKeyboardDismissDisabled>
      <Dialog>
        <div className={styles.BlockingToastHeader()}>
          <Icon icon={toastIcons[toast.type]} data-slot="icon" />
          <h2 className={styles.BlockingToastTitle()}>{toastTitles[toast.type]}</h2>
        </div>
        <p className={styles.BlockingToastMessage()}>{renderMessage(toast.message)}</p>
        <div className={styles.BlockingToastActions()}>
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
          {discardAction && (
            <Button onPress={() => { discardAction.onPress(); dismiss(toast.id) }}>
              {discardAction.label}
            </Button>
          )}
          {!retryAction && !discardAction && toast.actions?.map(action => (
            <Button key={slugify(action.label)} onPress={() => action.onPress()}>
              {action.label}
            </Button>
          ))}
        </div>
      </Dialog>
    </Modal>
  )
}
