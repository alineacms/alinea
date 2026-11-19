import {Button, Checkbox, Field, TextField, useDialog} from '#/components.js'
import {
  createContext,
  useContext,
  useState,
  type FormEvent,
  type ReactNode
} from 'react'
import {
  DashboardModal,
  DashboardModalCloseButton,
  DashboardModalDialog,
  DashboardModalForm,
  DashboardModalFormBody,
  DashboardModalFormFooter,
  DashboardModalFormHeader,
  DashboardModalTitle
} from './ui/DashboardModal.js'

export interface ExternalLinkValue {
  url: string
  title: string
  target: string
}

const ExternalLinkLabelContext = createContext(true)

export interface ExternalLinkLabelScopeProps {
  /** Ask for the label of external links picked within */
  showLabel: boolean
  children: ReactNode
}

/**
 * Leaves the label out of external links picked within, eg. when the text
 * that is linked already labels the link
 */
export function ExternalLinkLabelScope({
  showLabel,
  children
}: ExternalLinkLabelScopeProps) {
  return (
    <ExternalLinkLabelContext.Provider value={showLabel}>
      {children}
    </ExternalLinkLabelContext.Provider>
  )
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
    <DashboardModal
      aria-label={
        selectionMode === 'multiple' ? 'External links' : 'External link'
      }
    >
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
  const modal = useDialog()
  const showLabel = useContext(ExternalLinkLabelContext)
  const initialUrl = initialValue?.url ?? ''
  const initialTitle = initialValue?.title ?? ''
  const [url, setUrl] = useState(initialUrl)
  const parsedUrl = url.trim() ? URL.parse(url, 'https://example.com') : null
  const urlError =
    url && !parsedUrl
      ? 'Enter a valid URL, for example https://example.com'
      : undefined
  const [title, setTitle] = useState(initialTitle)
  const [openInNewTab, setOpenInNewTab] = useState(
    initialValue?.target !== '_self'
  )

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (!parsedUrl) return
    onConfirm({
      url,
      title,
      target: openInNewTab ? '_blank' : '_self'
    })
    modal.close()
  }

  return (
    <DashboardModalDialog variant="explorer">
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
            value={url}
            onValueChange={setUrl}
            error={urlError}
            required
          />
          {showLabel && (
            <TextField
              label="Label"
              value={title}
              onValueChange={setTitle}
              required
            />
          )}
          <Field label="Target">
            <Checkbox checked={openInNewTab} onCheckedChange={setOpenInNewTab}>
              Open link in new tab
            </Checkbox>
          </Field>
        </DashboardModalFormBody>
        <DashboardModalFormFooter>
          <Button type="submit" color="primary">
            {submitLabel ?? 'Add link'}
          </Button>
        </DashboardModalFormFooter>
      </DashboardModalForm>
    </DashboardModalDialog>
  )
}
