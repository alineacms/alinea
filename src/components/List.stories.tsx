import {Group} from 'react-aria-components'
import {Stack} from '../stories/Stack.tsx'
import {IcRoundClose} from '../stories/icons/IcRoundClose.tsx'
import {IcRoundEdit} from '../stories/icons/IcRoundEdit.tsx'
import {IcRoundSettings} from '../stories/icons/IcRoundSettings.tsx'
import {Button} from './Button.tsx'
import {Elevation} from './Elevation.tsx'
import {Icon} from './Icon.tsx'
import {List, ListItem} from './List.tsx'
import {TextField} from './TextField.tsx'

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
              <Stack align="normal">
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
              </Stack>
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
