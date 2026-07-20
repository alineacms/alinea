import {Button} from '#/components.js'
import {useToast} from '#/dashboard/store.js'
import {IcRoundClose} from '#/dashboard/icons.js'

export function ToastContainer() {
  const {toasts, dismiss} = useToast()
  const nonBlockingToasts = toasts.filter(toast => !toast.blocking)

  return (
    <>
      {nonBlockingToasts.map(toast => (
        <div key={toast.id}>
          <div>{toast.message}</div>
          <Button onPress={() => dismiss(toast.id)} icon={IcRoundClose}>
            Dismiss
          </Button>
        </div>
      ))}
    </>
  )
}
