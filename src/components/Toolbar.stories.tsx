import {Separator} from 'react-aria-components'
import {IcRoundBrightness} from '../stories/icons/IcRoundBrightness.js'
import {IcRoundUnfoldMore} from '../stories/icons/IcRoundUnfoldMore.js'
import {Button} from './Button.js'
import {Icon} from './Icon.js'
import {Menu, MenuItem} from './Menu.js'
import {Toolbar, ToolbarGroup} from './Toolbar.js'

export const Example = (args: any) => (
  <Toolbar aria-label="Text formatting" data-orientation="horizontal" {...args}>
    <ToolbarGroup>
      <Menu
        label={
          <Button appearance="plain">
            Options...
            <IcRoundUnfoldMore />
          </Button>
        }
      >
        <MenuItem>
          <IcRoundBrightness />
          Undo
        </MenuItem>
        <MenuItem>
          <IcRoundBrightness />
          Redo
        </MenuItem>
        <MenuItem>
          <IcRoundBrightness />
          Insert Link
        </MenuItem>
        <MenuItem>
          <IcRoundBrightness />
          Insert Image
        </MenuItem>
        <MenuItem>
          <IcRoundBrightness />
          Insert Grid
        </MenuItem>
      </Menu>
    </ToolbarGroup>

    <Separator />

    <ToolbarGroup>
      <Button size="square-petite" appearance="plain" data-appearance="active">
        <Icon icon={IcRoundBrightness} />
      </Button>

      <Menu
        label={
          <Button size="large" appearance="plain">
            <Icon icon={IcRoundBrightness} />
            <Icon icon={IcRoundUnfoldMore} />
          </Button>
        }
      >
        <MenuItem>
          <IcRoundBrightness />
          Undo
        </MenuItem>
        <MenuItem>
          <IcRoundBrightness />
          Redo
        </MenuItem>
        <MenuItem>
          <IcRoundBrightness />
          Insert Link
        </MenuItem>
        <MenuItem>
          <IcRoundBrightness />
          Insert Image
        </MenuItem>
        <MenuItem>
          <IcRoundBrightness />
          Insert Grid
        </MenuItem>
      </Menu>

      <Button size="square-petite" appearance="plain">
        <Icon icon={IcRoundBrightness} />
      </Button>

      <Button size="square-petite" appearance="plain">
        <Icon icon={IcRoundBrightness} />
      </Button>
    </ToolbarGroup>

    <Separator />

    <ToolbarGroup>
      <Button size="square-petite" appearance="plain">
        <Icon icon={IcRoundBrightness} />
      </Button>
      <Button size="square-petite" appearance="plain">
        <Icon icon={IcRoundBrightness} />
      </Button>
    </ToolbarGroup>

    <Separator />

    <ToolbarGroup>
      <Button size="square-petite" appearance="plain">
        <Icon icon={IcRoundBrightness} />
      </Button>
    </ToolbarGroup>

    <Separator />

    <ToolbarGroup>
      <Button size="square-petite" appearance="plain">
        <Icon icon={IcRoundBrightness} />
      </Button>
      <Button size="square-petite" appearance="plain">
        <Icon icon={IcRoundBrightness} />
      </Button>
    </ToolbarGroup>

    <Separator />

    <ToolbarGroup>
      <Button size="square-petite" appearance="plain">
        <Icon icon={IcRoundBrightness} />
      </Button>
    </ToolbarGroup>
  </Toolbar>
)

export default {
  title: 'Components / Toolbar'
}
