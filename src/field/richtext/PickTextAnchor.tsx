import {useCallback, useState, type FormEvent} from 'react'
import {Button, TextField} from '#/components.js'
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
} from '#/dashboard/app/ui/DashboardModal.js'

interface PickerValue {
  id: string
}

interface PendingTextAnchorPicker {
  anchor?: string
  resolve: (value: PickerValue | undefined) => void
}

export interface PickTextAnchorFunc {
  (anchor?: string): Promise<PickerValue | undefined>
}

interface PickTextAnchorState {
  isOpen: boolean
  pickAnchor: (anchor?: string) => Promise<PickerValue | undefined>
  anchor: string
  cancel: () => void
  confirm: (value: PickerValue | undefined) => void
}

interface PickTextAnchorProps {
  picker: PickTextAnchorState
}

export function usePickTextAnchor() {
  const [pending, setPending] = useState<PendingTextAnchorPicker | undefined>()
  const pickAnchor = useCallback((anchor?: string) => {
    return new Promise<PickerValue | undefined>(resolve => {
      setPending({anchor, resolve})
    })
  }, [])
  const cancel = useCallback(() => {
    setPending(current => {
      current?.resolve(undefined)
      return undefined
    })
  }, [])
  const confirm = useCallback((value: PickerValue | undefined) => {
    setPending(current => {
      current?.resolve(value)
      return undefined
    })
  }, [])
  return {
    isOpen: Boolean(pending),
    anchor: pending?.anchor ?? '',
    pickAnchor,
    cancel,
    confirm
  }
}

export function PickTextAnchor({picker}: PickTextAnchorProps) {
  if (!picker.isOpen) return null
  return (
    <DashboardModal
      isOpen
      onOpenChange={isOpen => {
        if (!isOpen) picker.cancel()
      }}
    >
      <PickTextAnchorForm picker={picker} />
    </DashboardModal>
  )
}

function PickTextAnchorForm({picker}: PickTextAnchorProps) {
  const modal = useDashboardModal()
  const [name, setName] = useState(picker.anchor ?? '')

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (event.target !== event.currentTarget) return
    event.preventDefault()
    picker.confirm({id: name.trim()})
    modal.close()
  }

  return (
    <DashboardModalDialog aria-label="Pick text anchor">
      <DashboardModalForm onSubmit={onSubmit}>
        <DashboardModalFormHeader>
          <DashboardModalTitle>Pick anchor link</DashboardModalTitle>
          <DashboardModalCloseButton />
        </DashboardModalFormHeader>
        <DashboardModalFormBody>
          <TextField
            description="Enter the anchor name"
            label="Anchor name"
            value={name}
            onChange={setName}
          />
        </DashboardModalFormBody>
        <DashboardModalFormFooter>
          <Button
            appearance="outline"
            intent="secondary"
            type="button"
            onPress={modal.close}
          >
            Cancel
          </Button>
          <Button type="submit">Confirm</Button>
        </DashboardModalFormFooter>
      </DashboardModalForm>
    </DashboardModalDialog>
  )
}
