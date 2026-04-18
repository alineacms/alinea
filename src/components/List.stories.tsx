import {Group} from 'react-aria-components'
import {
  IcRoundClose,
  IcRoundEdit,
  IcOutlineSettings as IcRoundSettings
} from '../dashboard/icons.js'
import {Button} from './Button.js'
import {Elevation} from './Elevation.js'
import {Icon} from './Icon.js'
import {List, ListItem} from './List.js'
import {TextField} from './TextField.js'

const itemControls = (
  <Group>
    <Button size="icon" appearance="plain">
      <IcRoundEdit data-slot="icon" />
    </Button>
    <Button size="icon" appearance="plain">
      <IcRoundClose data-slot="icon" />
    </Button>
  </Group>
)

export function Basic() {
  return (
    <>
      <style>{`
        strong{font-weight:500}
      `}</style>
      <List>
        <ListItem
          inner="This is a simple list item with a short description."
          trailing={itemControls}
        >
          <strong>Welcome</strong>
        </ListItem>
        <ListItem
          inner="Drafts updated by your team show up here."
          trailing={itemControls}
        >
          <strong>Recent activity</strong>
        </ListItem>
        <ListItem
          leading={<Icon icon={IcRoundSettings} />}
          trailing={itemControls}
          inner={
            <Elevation>
              <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
                You can put more complex content in the body, including links
                and controls.
                <TextField
                  placeholder="Type something..."
                  label="Inner field"
                />
                <List>
                  <ListItem trailing={itemControls}>
                    <strong>Inner list</strong>
                  </ListItem>
                  <ListItem trailing={itemControls}>
                    <strong>Is possible</strong>
                  </ListItem>
                </List>
              </div>
            </Elevation>
          }
        >
          <strong>About this workspace</strong>
        </ListItem>
      </List>
    </>
  )
}
export default {title: 'Components / List'}
