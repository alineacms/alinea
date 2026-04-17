import {Stack} from '../stories/Stack.js'
import {Elevation} from './Elevation.js'
import {List, ListItem} from './List.js'

export const Variants = () => (
  <Stack gap={24}>
    <div>
      <Elevation>
        Basic elevation with some content to show the spacing and shadow.
      </Elevation>
    </div>

    <List>
      <ListItem>Item 1</ListItem>
      <ListItem
        inner={
          <Elevation>
            Elevation can also be used inside other components to create nested
            sections.
          </Elevation>
        }
      >
        Item 2
      </ListItem>
    </List>
  </Stack>
)

export default {
  title: 'Components / Elevation'
}
