import {use} from 'react'
import {DialogTrigger, OverlayTriggerStateContext} from 'react-aria-components'
import {IcRoundClose} from '../v2/icons.js'
import {Button} from './Button.js'
import {Dialog} from './Dialog.js'
import {Modal} from './Modal.js'
import {TextField} from './TextField.js'

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
          <form>
            <TextField name="fname" isRequired label="First Name" autoFocus />
            <TextField name="lname" isRequired label="Last Name" />
            <Button slot="close" style={{marginTop: 8}}>
              Submit
            </Button>
          </form>
        </Dialog>
      </Modal>
    </DialogTrigger>
  )
}

export default {
  title: 'Components / Dialog'
}
