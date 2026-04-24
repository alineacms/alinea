import {Button, Checkbox, Label, TextField} from '#/components.js'
import {startTransition, useEffect, useState, type FormEvent} from 'react'
import {
  DashboardModal,
  DashboardModalCloseButton,
  DashboardModalDialog,
  DashboardModalForm,
  DashboardModalFormBody,
  DashboardModalFormFooter,
  DashboardModalFormHeader,
  DashboardModalTitle,
  useDashboardModal
} from './ui/DashboardModal.js'

export interface ExternalLinkValue {
  url: string
  title: string
  target: string
}

export interface ExternalLinkPickerProps {
  initialValue?: ExternalLinkValue
  selectionMode: 'single' | 'multiple'
  submitLabel?: string
  onConfirm: (value: ExternalLinkValue) => void
}

export function ExternalLinkPicker({
  initialValue,
  selectionMode,
  submitLabel,
  onConfirm
}: ExternalLinkPickerProps) {
  return (
    <DashboardModal>
      <ExternalLinkPickerDialog
        initialValue={initialValue}
        selectionMode={selectionMode}
        submitLabel={submitLabel}
        onConfirm={onConfirm}
      />
    </DashboardModal>
  )
}

function ExternalLinkPickerDialog({
  initialValue,
  selectionMode,
  submitLabel,
  onConfirm
}: ExternalLinkPickerProps) {
  const modal = useDashboardModal()
  const [url, setUrl] = useState(initialValue?.url ?? '')
  const [title, setTitle] = useState(initialValue?.title ?? '')
  const [openInNewTab, setOpenInNewTab] = useState(
    initialValue?.target !== '_self'
  )

  useEffect(() => {
    setUrl(initialValue?.url ?? '')
    setTitle(initialValue?.title ?? '')
    setOpenInNewTab(initialValue?.target !== '_self')
  }, [initialValue?.target, initialValue?.title, initialValue?.url])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(() => {
      onConfirm({url, title, target: openInNewTab ? '_blank' : '_self'})
      modal.close()
    })
  }

  return (
    <DashboardModalDialog
      aria-label={selectionMode === 'multiple' ? 'External links' : 'External link'}
      variant="explorer"
    >
      <DashboardModalForm onSubmit={onSubmit}>
        <DashboardModalFormHeader>
          <DashboardModalTitle>
            {selectionMode === 'multiple' ? 'External links' : 'External link'}
          </DashboardModalTitle>
          <DashboardModalCloseButton />
        </DashboardModalFormHeader>
        <DashboardModalFormBody>
          <TextField
            label="URL"
            description="Url of the link"
            value={url}
            onChange={setUrl}
            isRequired
          />
          <TextField
            label="Description"
            description="Text to display inside the link element"
            value={title}
            onChange={setTitle}
            isRequired
          />
          <Label label="Target">
            <Checkbox
              isSelected={openInNewTab}
              onChange={setOpenInNewTab}
              label="Open link in new tab"
            />
          </Label>
        </DashboardModalFormBody>
        <DashboardModalFormFooter>
          <Button type="submit">{submitLabel ?? 'Add link'}</Button>
        </DashboardModalFormFooter>
      </DashboardModalForm>
    </DashboardModalDialog>
  )
}
