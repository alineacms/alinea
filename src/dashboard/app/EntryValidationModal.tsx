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
  errors: Array<FieldValidationError>
  /** Publishes the entry as it is */
  publish(): void | Promise<void>
}

export interface EntryValidationModalProps {
  failure?: EntryValidationFailure
  onClose(): void
  onPublish(publish: () => void | Promise<void>): void
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

/** Lists the invalid fields of an entry about to be published */
export function EntryValidationModal({
  failure,
  onClose,
  onPublish
}: EntryValidationModalProps) {
  const isOpen = Boolean(failure)
  function close() {
    onClose()
    requestAnimationFrame(focusFirstInvalidField)
  }
  function publishAnyway() {
    if (!failure) return
    onClose()
    onPublish(failure.publish)
  }
  return (
    <DashboardModal
      open={isOpen}
      onOpenChange={open => {
        if (!open) close()
      }}
    >
      {isOpen && (
        <DashboardModalDialog label="Some fields are invalid">
          <DashboardModalContent>
            <Text as="p">
              Fix these fields before publishing, or publish the entry as it is.
            </Text>
            <ul className={styles.EntryValidationModal.list()}>
              {failure?.errors.map((error, index) => (
                <li key={index} className={styles.EntryValidationModal.item()}>
                  <Text weight="medium">{error.labels.join(' › ')}</Text>
                  <Text color="destructive">{error.message}</Text>
                </li>
              ))}
            </ul>
          </DashboardModalContent>
          <DashboardModalFooter>
            <Button variant="ghost" onClick={publishAnyway}>
              Publish anyway
            </Button>
            <Button color="primary" onClick={close}>
              Show fields
            </Button>
          </DashboardModalFooter>
        </DashboardModalDialog>
      )}
    </DashboardModal>
  )
}
