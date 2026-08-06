import {Button, Checkbox} from '#/components.js'
import type {RootAtoms} from '#/dashboard/atoms/root.js'
import {useAtomValue, useSetAtom} from 'jotai'
import {useState} from 'react'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from './ui/DashboardModal.js'

export interface ParentMoveConfirmationProps {
  root: RootAtoms
}

export function ParentMoveConfirmation({root}: ParentMoveConfirmationProps) {
  const pending = useAtomValue(root.pendingParentMove)
  const confirm = useSetAtom(root.confirmParentMove)
  const cancel = useSetAtom(root.cancelParentMove)
  const [skipConfirmation, setSkipConfirmation] = useState(false)
  const isOpen = pending !== null

  return (
    <DashboardModal isOpen={isOpen} isDismissable={false}>
      <DashboardModalDialog
        label="Move entry"
        closeButton={false}
        variant="confirmation"
      >
        <DashboardModalContent>
          <p>Are you sure you want to move this entry to a new parent?</p>
          <Checkbox
            isSelected={skipConfirmation}
            onChange={setSkipConfirmation}
          >
            Don&apos;t ask again this session
          </Checkbox>
        </DashboardModalContent>
        <DashboardModalFooter>
          <Button intent="secondary" onPress={cancel}>
            Cancel
          </Button>
          <Button
            intent="primary"
            onPress={() => void confirm(skipConfirmation)}
          >
            Move entry
          </Button>
        </DashboardModalFooter>
      </DashboardModalDialog>
    </DashboardModal>
  )
}
