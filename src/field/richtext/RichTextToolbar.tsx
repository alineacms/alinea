import styler from '@alinea/styler'
import type {Editor} from '@tiptap/react'
import type {Reference} from 'alinea/core/Reference'
import {values} from 'alinea/core/util/Objects'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import type {UrlReference} from 'alinea/picker/url'
import {HStack, Icon, px} from 'alinea/ui'
import {DropdownMenu} from 'alinea/ui/DropdownMenu'
import {type ReactNode, useMemo} from 'react'
import type {PickTextLinkFunc} from './PickTextLink.js'
import {attributesToReference, referenceToAttributes} from './ReferenceLink.js'
import css from './RichTextToolbar.module.scss'
import {defaultToolbar} from './Toolbar.js'

const styles = styler(css)

export type RichTextCommand = () => ReturnType<Editor['chain']>

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

export type ToolbarConfig = {
  [name: string]: ToolbarMenu | ToolbarButton
}

export interface RichTextToolbarProps {
  editor: Editor
  focusToggle: (target: EventTarget | null) => void
  pickLink: PickTextLinkFunc
  enableTables?: boolean
  toolbar?: ToolbarConfig
}

export function createToolbarExec(editor: Editor): RichTextCommand {
  return () => editor.chain().focus(null, {scrollIntoView: false})
}

export function createLinkHandler(
  editor: Editor,
  pickLink: PickTextLinkFunc,
  exec = createToolbarExec(editor)
) {
  return function handleLink() {
    const attrs = editor.getAttributes('link')
    const existing: Reference | undefined = attributesToReference(attrs)
    const {view} = editor
    const {from, to} = view.state.selection
    const isSelection = from !== to
    return pickLink({
      link: existing,
      title: attrs.title,
      blank: attrs.target === '_blank',
      hasLink: Boolean(existing),
      requireDescription: !isSelection
    })
      .then(picked => {
        if (!picked || !picked.link) {
          exec().unsetLink().run()
          return
        }
        const link = picked.link
        const linkAttrs = {
          title: picked.title,
          ...referenceToAttributes(link),
          target:
            (link as UrlReference)._target ??
            (picked.blank ? '_blank' : undefined)
        }
        if (existing) {
          exec().extendMarkRange('link').setLink(linkAttrs).run()
        } else if (isSelection) {
          exec()
            .setLink(linkAttrs as any)
            .run()
        } else {
          exec()
            .insertContent({
              type: 'text',
              text:
                picked.title ||
                (link as UrlReference)._title ||
                (link as UrlReference)._url ||
                '',
              marks: [{type: 'link', attrs: linkAttrs}]
            })
            .run()
        }
      })
      .catch(console.error)
  }
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

interface ToolbarButtonProps {
  button: ToolbarButton
  ctx: RichTextToolbarContext
}

function ToolbarButton({button, ctx}: ToolbarButtonProps) {
  const icon = button.icon?.(ctx)
  const active = button.active?.(ctx)
  const disabled = button.disabled?.(ctx)
  const label =
    typeof button.label === 'function' ? button.label(ctx) : button.label
  return (
    <>
      <IconButton
        icon={icon}
        onClick={e => {
          e.preventDefault()
          button.onSelect(ctx)
        }}
        active={active}
        disabled={disabled}
      />
      {label}
    </>
  )
}

interface ToolbarMenuProps {
  ctx: RichTextToolbarContext
  menu: ToolbarMenu
}

function ToolbarMenu({ctx, menu}: ToolbarMenuProps) {
  const icon = menu.icon?.(ctx)
  const label = typeof menu.label === 'function' ? menu.label(ctx) : menu.label
  const config = typeof menu.items === 'function' ? menu.items(ctx) : menu.items
  return (
    <DropdownMenu.Root top>
      <DropdownMenu.Trigger className={styles.root.dropdown()}>
        <HStack gap={10} center>
          {icon && <Icon icon={icon} />}
          <span>{label}</span>
        </HStack>
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        <ToolbarItems config={config} ctx={ctx} />
      </DropdownMenu.Items>
    </DropdownMenu.Root>
  )
}

interface ToolbarItemsProps {
  config: ToolbarConfig
  ctx: RichTextToolbarContext
}

function ToolbarItems({config, ctx}: ToolbarItemsProps) {
  return values(config)
    .map((entry, index) => {
      if ('items' in entry) {
        if ('label' in entry || 'icon' in entry)
          return <ToolbarMenu key={`item-${index}`} menu={entry} ctx={ctx} />
        const config =
          typeof entry.items === 'function' ? entry.items(ctx) : entry.items
        return <ToolbarItems key={`item-${index}`} config={config} ctx={ctx} />
      }
      return <ToolbarButton key={`item-${index}`} button={entry} ctx={ctx} />
    })
    .reduce((result, _, index) => {
      if (index > 0) result.push(<Separator key={`sep-${index}`} />)
      return result
    }, Array<ReactNode>())
}

function Separator() {
  return <div className={styles.root.separator()} />
}

export function RichTextToolbar(props: RichTextToolbarProps) {
  const config: ToolbarConfig = props.toolbar ?? defaultToolbar
  const ctx = useMemo(() => {
    const exec = createToolbarExec(props.editor)
    const handleLink = createLinkHandler(props.editor, props.pickLink, exec)
    return {
      editor: props.editor,
      focusToggle: props.focusToggle,
      pickLink: props.pickLink,
      enableTables: props.enableTables,
      exec,
      handleLink,
      toolbar: config
    }
  }, [config])
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: because
    <div
      tabIndex={-1}
      className={styles.root()}
      data-richtext-toolbar="true"
      onFocus={e => ctx.focusToggle(e.currentTarget)}
      onBlur={e => ctx.focusToggle(e.relatedTarget)}
    >
      <HStack gap={10} center style={{height: '100%', padding: `${px(4)} 0`}}>
        <ToolbarItems config={config} ctx={ctx} />
      </HStack>
    </div>
  )
}
