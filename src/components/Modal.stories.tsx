import {DialogTrigger, Heading, Text} from 'react-aria-components'
import {Button} from './Button.js'
import {Dialog} from './Dialog.js'
import {Modal} from './Modal.js'
import {TextField} from './TextField.js'

export const Example = () => (
  <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
    <DialogTrigger>
      <Button>Click to open modal</Button>
      <Modal isDismissable>
        <Dialog>
          <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
            <Heading slot="title">Modal title</Heading>
            <Text>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque
              egestas porta purus dignissim auctor. Pellentesque porttitor nec
              tortor in porta. Curabitur ligula nunc, ullamcorper id risus id,
              lacinia tempor tortor.
            </Text>
            <Button slot="close">Close modal</Button>
          </div>
        </Dialog>
      </Modal>
    </DialogTrigger>
    <DialogTrigger>
      <Button>Sign up</Button>
      <Modal isDismissable style={{width: 460}}>
        <Dialog>
          <form>
            <h1>Sign up</h1>
            <TextField name="fname" isRequired label="First Name" autoFocus />
            <TextField name="lname" isRequired label="Last Name" />
            <Button type="submit" slot="close">
              Submit
            </Button>
          </form>
        </Dialog>
      </Modal>
    </DialogTrigger>
    <DialogTrigger>
      <Button intent="danger">Delete entry</Button>
      <Modal isDismissable style={{width: 460}}>
        <Dialog>
          <form>
            <Heading slot="title">Delete entry</Heading>
            <Text>
              Are you sure you want to delete "Documents"? All contents will be
              permanently destroyed.
            </Text>
            <TextField
              name="delete_verification"
              isRequired
              label="To confirm, type 'DELETE' in the box below"
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8
              }}
            >
              <Button type="submit" slot="close" intent="secondary">
                Cancel
              </Button>
              <Button type="submit" slot="close" intent="danger" isDisabled>
                Delete
              </Button>
            </div>
          </form>
        </Dialog>
      </Modal>
    </DialogTrigger>
  </div>
)

export default {
  title: 'Components / Modal'
}
