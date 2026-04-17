import {use} from 'react'
import {DialogTrigger, OverlayTriggerStateContext} from 'react-aria-components'
import {IcRoundClose} from '../stories/icons/IcRoundClose.tsx'
import {Form} from '../todo/Form.tsx'
import {Button} from './Button.tsx'
import {Dialog} from './Dialog.tsx'
import {Modal} from './Modal.tsx'
import {TextField} from './TextField.tsx'

function CloseButton() {
  const state = use(OverlayTriggerStateContext)
  return (
    <Button
      size="square-petite"
      appearance="plain"
      onPress={() => state!.close()}
    >
      <IcRoundClose data-slot="icon" />
    </Button>
  )
}

export const Example = () => {
  return (
    <DialogTrigger>
      <Button>Sign up…</Button>
      <Modal>
        <Dialog>
          Sign up
          <CloseButton />
          <Form>
            <TextField name="fname" isRequired label="First Name" autoFocus />
            <TextField name="lname" isRequired label="Last Name" />
            <Button slot="close" style={{marginTop: 8}}>
              Submit
            </Button>
          </Form>
        </Dialog>
      </Modal>
    </DialogTrigger>
  )
}

export default {
  title: 'Components / Dialog'
}
