import {Button, Text} from '#/components.js'
import type {FieldValidationError} from '#/core/Validation.js'
import styler from '@alinea/styler'
import css from './EntryValidationModal.module.css'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from './ui/DashboardModal.js'

const styles = styler(css)

export interface EntryValidationFailure {
  errors?: Array<FieldValidationError>
  /** Shown when the errors came back from the server without details */
  message?: string
}

export interface EntryValidationModalProps {
  failure?: EntryValidationFailure
  onClose(): void
}

/** Focus the first invalid field rendered in the editor */
function focusFirstInvalidField() {
  const field = document.querySelector<HTMLElement>(
    '[data-slot="field"][data-invalid]'
  )
  if (!field) return
  field.scrollIntoView({block: 'center'})
  const control = field.querySelector<HTMLElement>(
    'input:not([type="hidden"]), textarea, select, button, [contenteditable="true"], [tabindex]:not([tabindex="-1"])'
  )
  control?.focus({preventScroll: true})
}

/** Explains why an entry cannot be published and lists the invalid fields */
export function EntryValidationModal({
  failure,
  onClose
}: EntryValidationModalProps) {
  const isOpen = Boolean(failure)
  function close() {
    onClose()
    requestAnimationFrame(focusFirstInvalidField)
  }
  return (
    <DashboardModal
      open={isOpen}
      onOpenChange={open => {
        if (!open) close()
      }}
    >
      {isOpen && (
        <DashboardModalDialog label="Fix invalid fields before publishing">
          <DashboardModalContent>
            <Text as="p">
              This entry cannot be published until these fields are valid.
            </Text>
            {failure?.errors?.length ? (
              <ul className={styles.EntryValidationModal.list()}>
                {failure.errors.map((error, index) => (
                  <li
                    key={index}
                    className={styles.EntryValidationModal.item()}
                  >
                    <Text weight="medium">{error.labels.join(' › ')}</Text>
                    <Text color="destructive">{error.message}</Text>
                  </li>
                ))}
              </ul>
            ) : (
              <Text as="p" className={styles.EntryValidationModal.message()}>
                {failure?.message}
              </Text>
            )}
          </DashboardModalContent>
          <DashboardModalFooter>
            <Button color="primary" onClick={close}>
              Show fields
            </Button>
          </DashboardModalFooter>
        </DashboardModalDialog>
      )}
    </DashboardModal>
  )
}
