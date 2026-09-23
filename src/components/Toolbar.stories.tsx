import {
  IcRoundFormatAlignLeft,
  IcRoundFormatBold,
  IcRoundRedo,
  IcRoundUndo,
  IcRoundUnfoldMore
} from '../dashboard/icons.js'
import {Button} from './Button.js'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './DropdownMenu.js'
import {Toolbar, ToolbarGroup, ToolbarSeparator} from './Toolbar.js'

export const Example = (args: any) => (
  <Toolbar aria-label="Text formatting" data-orientation="horizontal" {...args}>
    <ToolbarGroup>
      <Button variant="ghost" size="icon-lg" icon={IcRoundUndo} />
      <Button variant="ghost" size="icon-lg" icon={IcRoundRedo} />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <DropdownMenu>
        <DropdownMenuTrigger variant="ghost">
          Heading
          <IcRoundUnfoldMore />
        </DropdownMenuTrigger>
        <DropdownMenuContent aria-label="Heading">
          {[
            {icon: IcRoundFormatBold, label: 'Heading 2'},
            {icon: IcRoundFormatBold, label: 'Heading 3'},
            {icon: IcRoundFormatBold, label: 'Heading 4'},
            {icon: IcRoundFormatBold, label: 'Heading 5'}
          ].map(({icon, label}) => (
            <DropdownMenuItem key={label} icon={icon}>
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <Button variant="ghost" size="icon-lg" icon={IcRoundFormatBold} />
      <Button variant="ghost" size="icon-lg" icon={IcRoundFormatBold} />
      <Button variant="ghost" size="icon-lg" icon={IcRoundFormatBold} />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <DropdownMenu>
        <DropdownMenuTrigger
          variant="ghost"
          icon={IcRoundFormatAlignLeft}
          aria-label="Alignment"
        >
          <IcRoundUnfoldMore />
        </DropdownMenuTrigger>
        <DropdownMenuContent aria-label="Alignment">
          {[
            {icon: IcRoundFormatAlignLeft, label: 'Align left'},
            {icon: IcRoundFormatAlignLeft, label: 'Align center'},
            {icon: IcRoundFormatAlignLeft, label: 'Align right'},
            {icon: IcRoundFormatAlignLeft, label: 'Align justify'}
          ].map(({icon, label}) => (
            <DropdownMenuItem key={label} icon={icon}>
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size="icon-lg" icon={IcRoundFormatBold} />
      <Button variant="ghost" size="icon-lg" icon={IcRoundFormatBold} />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <Button variant="ghost" size="icon-lg" icon={IcRoundFormatBold} />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <Button variant="ghost" size="icon-lg" icon={IcRoundFormatBold} />
    </ToolbarGroup>
  </Toolbar>
)

export default {
  title: 'Components / Toolbar'
}
