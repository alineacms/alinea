import {DialogTrigger, Heading, Text} from 'react-aria-components'
import {Stack} from '../stories/Stack.tsx'
import {Form} from '../todo/Form.tsx'
import {Button} from './Button.tsx'
import {Dialog} from './Dialog.tsx'
import {Modal} from './Modal.tsx'
import {TextField} from './TextField.tsx'

export const Example = () => (
  <Stack>
    <DialogTrigger>
      <Button>Click to open modal</Button>
      <Modal isDismissable>
        <Dialog>
          <Stack>
            <Heading slot="title">Modal title</Heading>
            <Text>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque
              egestas porta purus dignissim auctor. Pellentesque porttitor nec
              tortor in porta. Curabitur ligula nunc, ullamcorper id risus id,
              lacinia tempor tortor.
            </Text>
            <Button slot="close">Close modal</Button>
          </Stack>
        </Dialog>
      </Modal>
    </DialogTrigger>
    <DialogTrigger>
      <Button>Sign up</Button>
      <Modal isDismissable style={{width: 460}}>
        <Dialog>
          <Form>
            <h1>Sign up</h1>
            <TextField name="fname" isRequired label="First Name" autoFocus />
            <TextField name="lname" isRequired label="Last Name" />
              <Button type="submit" slot="close">
                Submit
              </Button>
          </Form>
        </Dialog>
      </Modal>
    </DialogTrigger>
    <DialogTrigger>
      <Button intent="danger">Delete entry</Button>
      <Modal isDismissable style={{width: 460}}>
        <Dialog>
          <Form>
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
          </Form>
        </Dialog>
      </Modal>
    </DialogTrigger>
  </Stack>
)

export default {
  title: 'Components / Modal'
}
