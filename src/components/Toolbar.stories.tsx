import {
  IcRoundFormatAlignLeft,
  IcRoundFormatBold,
  IcRoundRedo,
  IcRoundUndo,
  IcRoundUnfoldMore
} from '../dashboard/icons.js'
import {Button} from './Button.js'
import {Icon} from './Icon.js'
import {Menu, MenuItem} from './Menu.js'
import {Toolbar, ToolbarGroup, ToolbarSeparator} from './Toolbar.js'

export const Example = (args: any) => (
  <Toolbar aria-label="Text formatting" data-orientation="horizontal" {...args}>
    <ToolbarGroup>
      <Button appearance="plain" size="square-petite" icon={IcRoundUndo} />
      <Button appearance="plain" size="square-petite" icon={IcRoundRedo} />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <Menu
        label={
          <Button appearance="plain">
            Heading
            <IcRoundUnfoldMore />
          </Button>
        }
      >
        {[
          {icon: IcRoundFormatBold, label: 'Heading 2'},
          {icon: IcRoundFormatBold, label: 'Heading 3'},
          {icon: IcRoundFormatBold, label: 'Heading 4'},
          {icon: IcRoundFormatBold, label: 'Heading 5'}
        ].map(({icon, label}) => (
          <MenuItem key={label}>
            <Icon icon={icon} />
            {label}
          </MenuItem>
        ))}
      </Menu>
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <Button
        appearance="plain"
        size="square-petite"
        icon={IcRoundFormatBold}
      />
      <Button
        appearance="plain"
        size="square-petite"
        icon={IcRoundFormatBold}
      />
      <Button
        appearance="plain"
        size="square-petite"
        icon={IcRoundFormatBold}
      />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <Menu
        label={
          <Button appearance="plain">
            <Icon icon={IcRoundFormatAlignLeft} />
            <Icon icon={IcRoundUnfoldMore} />
          </Button>
        }
      >
        {[
          {icon: IcRoundFormatAlignLeft, label: 'Align left'},
          {icon: IcRoundFormatAlignLeft, label: 'Align center'},
          {icon: IcRoundFormatAlignLeft, label: 'Align right'},
          {icon: IcRoundFormatAlignLeft, label: 'Align justify'}
        ].map(({icon, label}) => (
          <MenuItem key={label}>
            <Icon icon={icon} />
            {label}
          </MenuItem>
        ))}
      </Menu>

      <Button
        appearance="plain"
        size="square-petite"
        icon={IcRoundFormatBold}
      />
      <Button
        appearance="plain"
        size="square-petite"
        icon={IcRoundFormatBold}
      />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <Button
        appearance="plain"
        size="square-petite"
        icon={IcRoundFormatBold}
      />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <Button
        appearance="plain"
        size="square-petite"
        icon={IcRoundFormatBold}
      />
    </ToolbarGroup>
  </Toolbar>
)

export default {
  title: 'Components / Toolbar'
}
