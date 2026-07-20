import {Button, Dialog, Modal} from '#/components.js'
import {useToast} from '#/dashboard/store.js'
import {IcRoundClose} from '#/dashboard/icons.js'
import {slugify} from '#/core/util/Slugs.js'

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
  if (toast == null) return null

  return (
    <Modal isOpen isDismissable={false} isKeyboardDismissDisabled>
      <Dialog>
        <p>{toast.message}</p>
        {toast.actions &&
          toast.actions.map(action => (
            <Button
              key={slugify(action.label)}
              onPress={action.onPress}
              intent="primary"
            >
              {action.label}
            </Button>
          ))}
        {!toast.actions && (
          <Button onPress={() => dismiss(toast.id)}>Dismiss</Button>
        )}
      </Dialog>
    </Modal>
  )
}
