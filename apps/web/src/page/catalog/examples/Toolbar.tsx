'use client'

import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
  ToolbarToggleGroup,
  ToolbarToggleItem
} from 'alinea/components'
import {
  IcRoundFormatBold,
  IcRoundFormatItalic,
  IcRoundLink,
  IcRoundRedo,
  IcRoundUndo
} from 'alinea/dashboard/icons'

export function ToolbarExample() {
  return (
    <Toolbar aria-label="Text formatting">
      <ToolbarGroup>
        <ToolbarButton size="icon" icon={IcRoundUndo} aria-label="Undo" />
        <ToolbarButton size="icon" icon={IcRoundRedo} aria-label="Redo" />
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarToggleGroup
        type="multiple"
        defaultValue={['bold']}
        aria-label="Marks"
      >
        <ToolbarToggleItem
          value="bold"
          icon={IcRoundFormatBold}
          aria-label="Bold"
        />
        <ToolbarToggleItem
          value="italic"
          icon={IcRoundFormatItalic}
          aria-label="Italic"
        />
      </ToolbarToggleGroup>
      <ToolbarSeparator />
      <ToolbarButton size="icon" icon={IcRoundLink} aria-label="Link" />
    </Toolbar>
  )
}
