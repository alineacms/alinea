import {Button, Checkbox, Label, TextField} from '#/components.js'
import {startTransition, useState} from 'react'
import {
  DashboardModal,
  DashboardModalCloseButton,
  DashboardModalDialog,
  dashboardModalStyles,
  useDashboardModal
} from './ui/DashboardModal.js'
import {RailBody, RailFooter, RailHeader} from './ui/Rail.js'

export interface ExternalLinkValue {
  url: string
  title: string
  target: string
}

export interface ExternalLinkPickerProps {
  selectionMode: 'single' | 'multiple'
  onConfirm: (value: ExternalLinkValue) => void
}

export function ExternalLinkPicker({
  selectionMode,
  onConfirm
}: ExternalLinkPickerProps) {
  return (
    <DashboardModal>
      <ExternalLinkPickerDialog
        selectionMode={selectionMode}
        onConfirm={onConfirm}
      />
    </DashboardModal>
  )
}

function ExternalLinkPickerDialog({
  selectionMode,
  onConfirm
}: ExternalLinkPickerProps) {
  const modal = useDashboardModal()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [openInNewTab, setOpenInNewTab] = useState(true)

  function onSubmit() {
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
      <RailHeader className={dashboardModalStyles.DashboardModalForm.header()}>
        <span />
        <DashboardModalCloseButton />
      </RailHeader>
      <RailBody className={dashboardModalStyles.DashboardModalForm.body()}>
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
      </RailBody>
      <RailFooter className={dashboardModalStyles.DashboardModalForm.footer()}>
        <span />
        <Button onPress={onSubmit}>Add link</Button>
      </RailFooter>
    </DashboardModalDialog>
  )
}
