import {useState} from 'react'
import {
  IcRoundFormatAlignCenter,
  IcRoundFormatAlignLeft,
  IcRoundFormatAlignRight,
  IcRoundFormatBold,
  IcRoundFormatItalic,
  IcRoundRedo,
  IcRoundUndo
} from '../dashboard/icons.js'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './DropdownMenu.js'
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
  ToolbarToggleGroup,
  ToolbarToggleItem
} from './Toolbar.js'

export function Example() {
  const [log, setLog] = useState<Array<string>>([])
  const [marks, setMarks] = useState<Array<string>>([])
  const [align, setAlign] = useState('left')
  return (
    <div>
      <Toolbar aria-label="Text formatting">
        <ToolbarGroup>
          <ToolbarButton
            size="icon-lg"
            icon={IcRoundUndo}
            aria-label="Undo"
            onClick={() => setLog([...log, 'undo'])}
          />
          <ToolbarButton
            size="icon-lg"
            icon={IcRoundRedo}
            aria-label="Redo"
            disabled
          />
        </ToolbarGroup>
        <ToolbarSeparator />
        <ToolbarToggleGroup
          type="multiple"
          aria-label="Marks"
          value={marks}
          onValueChange={setMarks}
        >
          <ToolbarToggleItem
            value="bold"
            aria-label="Bold"
            icon={IcRoundFormatBold}
          />
          <ToolbarToggleItem
            value="italic"
            aria-label="Italic"
            icon={IcRoundFormatItalic}
          />
        </ToolbarToggleGroup>
        <ToolbarSeparator />
        <ToolbarToggleGroup
          type="single"
          aria-label="Alignment"
          value={align}
          onValueChange={setAlign}
        >
          <ToolbarToggleItem
            value="left"
            aria-label="Align left"
            icon={IcRoundFormatAlignLeft}
          />
          <ToolbarToggleItem
            value="center"
            aria-label="Align center"
            icon={IcRoundFormatAlignCenter}
          />
          <ToolbarToggleItem
            value="right"
            aria-label="Align right"
            icon={IcRoundFormatAlignRight}
          />
        </ToolbarToggleGroup>
        <ToolbarSeparator />
        <DropdownMenu>
          <DropdownMenuTrigger variant="ghost">Heading</DropdownMenuTrigger>
          <DropdownMenuContent aria-label="Heading">
            <DropdownMenuItem>Heading 2</DropdownMenuItem>
            <DropdownMenuItem>Heading 3</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Toolbar>
      <p>
        Actions: {log.join(', ') || 'none'}; marks: {marks.join(', ') || 'none'}
        ; align: {align || 'none'}
      </p>
    </div>
  )
}

export function Vertical() {
  return (
    <Toolbar orientation="vertical" aria-label="Tools">
      <ToolbarButton size="icon-lg" icon={IcRoundUndo} aria-label="Undo" />
      <ToolbarSeparator />
      <ToolbarButton size="icon-lg" icon={IcRoundRedo} aria-label="Redo" />
    </Toolbar>
  )
}

export default {
  title: 'Pure components / Toolbar'
}
