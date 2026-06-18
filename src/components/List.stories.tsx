import {DialogTrigger} from 'react-aria-components'
import {Badge} from '../dashboard/app/Badge.js'
import {
  IcRoundClose,
  IcRoundEdit,
  IcRoundMoreHoriz,
  IcRoundPanorama,
  IcOutlineSettings as IcRoundSettings
} from '../dashboard/icons.js'
import {Button} from './Button.js'
import {
  List,
  ListCreateRow,
  ListDragPreview,
  ListError,
  ListItem,
  ListLabel,
  ListRow,
  ListRowActions,
  ListRowBadges,
  ListRowBody,
  ListRowDrag,
  ListRowFoldButton,
  ListRowFooter,
  ListRowHeader,
  ListRowMeta,
  ListRowSettings,
  ListRowSettingsButton
} from './List.js'
import {Popover} from './Popover.js'
import {Surface, SurfaceContent} from './Surface.js'
import {TextField} from './TextField.js'

const itemControls = (
  <div style={{display: 'flex'}}>
    <Button size="icon" appearance="plain" icon={IcRoundEdit} />
    <Button size="icon" appearance="plain" icon={IcRoundClose} />
  </div>
)

export function Basic() {
  return (
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
        leading={<IcRoundSettings data-slot="icon" />}
        trailing={itemControls}
        inner={
          <Surface>
            <SurfaceContent>
              <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
                You can put more complex content in the body, including links
                and controls.
                <TextField
                  placeholder="Type something..."
                  label="Inner field"
                />
              </div>
            </SurfaceContent>
          </Surface>
        }
      >
        <strong>About this workspace</strong>
      </ListItem>
    </List>
  )
}

export function FieldRows() {
  return (
    <div style={{maxWidth: 720}}>
      <ListLabel aria-label="Collapse all items" expanded hasRows shared>
        Sections
      </ListLabel>
      <List data-depth="muted">
        <ListRow aria-label="Hero item 1" first role="listitem">
          <ListRowHeader expanded first>
            <ListRowDrag>
              <ListRowBadges>
                <ListRowFoldButton
                  aria-label="Collapse hero"
                  expanded
                  onPress={() => undefined}
                />
                <Badge icon={IcRoundPanorama} size="small">
                  Hero
                </Badge>
                <ListRowMeta>Landing page intro</ListRowMeta>
                <Badge size="small">#landing-page-intro</Badge>
              </ListRowBadges>
            </ListRowDrag>
            <ListRowActions>
              <DialogTrigger>
                <ListRowSettingsButton
                  aria-label="Hero settings"
                  icon={IcRoundMoreHoriz}
                />
                <Popover placement="bottom right">
                  <ListRowSettings>
                    <TextField label="Label" value="Landing page intro" />
                    <TextField label="Anchor" value="landing-page-intro" />
                  </ListRowSettings>
                </Popover>
              </DialogTrigger>
            </ListRowActions>
          </ListRowHeader>
          <ListRowBody>
            <TextField label="Heading" value="Build structured pages" />
            <TextField
              label="Body"
              value="Compose reusable content sections with a list field."
            />
          </ListRowBody>
        </ListRow>
        <ListRow aria-label="Quote item 2" role="listitem">
          <ListRowHeader>
            <ListRowDrag>
              <ListRowBadges>
                <ListRowFoldButton
                  aria-label="Expand quote"
                  expanded={false}
                  onPress={() => undefined}
                />
                <Badge size="small">Quote</Badge>
                <ListRowMeta>Editorial quote</ListRowMeta>
              </ListRowBadges>
            </ListRowDrag>
            <ListRowActions>
              <ListRowSettingsButton
                aria-label="Quote settings"
                icon={IcRoundMoreHoriz}
              />
            </ListRowActions>
          </ListRowHeader>
          <ListRowFooter>
            Quote: Content editing should stay close...
          </ListRowFooter>
        </ListRow>
        <ListCreateRow>
          <Button appearance="plain" size="small">
            Add Hero
          </Button>
          <Button appearance="plain" size="small">
            Add Quote
          </Button>
        </ListCreateRow>
      </List>
      <ListError>At least one section is required.</ListError>
    </div>
  )
}

export function DragPreview() {
  return <ListDragPreview icon={IcRoundPanorama} label="Hero" />
}

export default {title: 'Components / List'}
