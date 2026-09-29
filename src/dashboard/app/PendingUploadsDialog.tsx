import {
  cancelPendingUploadsAtom,
  confirmPendingUploadsAtom,
  pendingUploadsAtom,
  removePendingUploadAtom,
  updatePendingUploadAtom
} from '#/dashboard/atoms/upload.js'
import {useAtomValueRaw, useSetAtom} from 'jotai'
import {PendingUploadsView} from './PendingUploadsView.js'
import {DashboardModal} from './ui/DashboardModal.js'

/** Asks what to do with files before they are uploaded */
export function PendingUploadsDialog() {
  const pending = useAtomValueRaw(pendingUploadsAtom)
  const update = useSetAtom(updatePendingUploadAtom)
  const remove = useSetAtom(removePendingUploadAtom)
  const cancel = useSetAtom(cancelPendingUploadsAtom)
  const confirm = useSetAtom(confirmPendingUploadsAtom)
  return (
    <DashboardModal
      aria-label="Upload files"
      open={pending !== undefined}
      dismissable={false}
      onOpenChange={open => {
        if (!open) cancel()
      }}
    >
      {pending && (
        <PendingUploadsView
          pending={pending}
          onChange={update}
          onRemove={remove}
          onCancel={cancel}
          onConfirm={() => void confirm()}
        />
      )}
    </DashboardModal>
  )
}
