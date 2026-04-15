import type {Editor} from '@tiptap/react'
import type {ReactNode} from 'react'
import type {PickTextLinkFunc} from './PickTextLink.js'

export interface RichTextCommand {
  (): ReturnType<Editor['chain']>
}

export interface ToolbarButton {
  icon?: (ctx: RichTextToolbarContext) => ReactNode
  label?: ReactNode | ((ctx: RichTextToolbarContext) => ReactNode)
  title?: string
  disabled?: (ctx: RichTextToolbarContext) => boolean
  active?: (ctx: RichTextToolbarContext) => boolean
  onSelect: (ctx: RichTextToolbarContext) => void
}

export interface ToolbarMenu {
  icon?: (ctx: RichTextToolbarContext) => ReactNode
  label?: ReactNode | ((ctx: RichTextToolbarContext) => ReactNode)
  items: ToolbarConfig | ((ctx: RichTextToolbarContext) => ToolbarConfig)
}

export interface ToolbarGroup {
  group: ToolbarConfig | ((ctx: RichTextToolbarContext) => ToolbarConfig)
}

export interface ToolbarConfig {
  [name: string]: ToolbarMenu | ToolbarButton | ToolbarGroup
}

export interface RichTextToolbarContext {
  editor: Editor
  focusToggle: (target: EventTarget | null) => void
  pickLink: PickTextLinkFunc
  enableTables?: boolean
  exec: RichTextCommand
  handleLink: () => void
  toolbar: ToolbarConfig
}
