import {Reference} from '@alinea/core/Reference'
import {Modal} from '@alinea/ui/Modal'

export type ExternalLinkPickerOptions = {}

export type ExternalLinkPickerProps = {
  options: ExternalLinkPickerOptions
  onConfirm: (value: Array<Reference> | undefined) => void
  onCancel: () => void
}
export function ExternalLinkPicker({
  options,
  onConfirm,
  onCancel
}: ExternalLinkPickerProps) {
  return (
    <Modal open onClose={onCancel}>
      pick link
    </Modal>
  )
}
