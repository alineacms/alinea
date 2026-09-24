'use client'

import {
  List,
  ListItem,
  ListItemDescription,
  ListItemStatus,
  ListItemTitle,
  ListItemVisual
} from 'alinea/components'
import {IcOutlineDrafts, IcRoundCheck} from 'alinea/dashboard/icons'

export function ListExample() {
  return (
    <List aria-label="History" style={{width: 360}}>
      <ListItem
        leading={
          <ListItemVisual>
            <IcOutlineDrafts data-slot="icon" />
          </ListItemVisual>
        }
        trailing={<ListItemStatus color="primary">Draft</ListItemStatus>}
      >
        <ListItemTitle>Linen shirt</ListItemTitle>
        <ListItemDescription>Maya Janssens · 10:48</ListItemDescription>
      </ListItem>
      <ListItem
        leading={
          <ListItemVisual>
            <IcRoundCheck data-slot="icon" />
          </ListItemVisual>
        }
        trailing={<ListItemStatus color="success">Published</ListItemStatus>}
      >
        <ListItemTitle>Oak dining chair</ListItemTitle>
        <ListItemDescription>Tom Verbeke · Yesterday</ListItemDescription>
      </ListItem>
    </List>
  )
}
