import styler from '@alinea/styler'
import type {Editor} from '@tiptap/react'
import type {Reference} from 'alinea/core/Reference'
import {values} from 'alinea/core/util/Objects'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import type {UrlReference} from 'alinea/picker/url'
import {HStack, Icon, px} from 'alinea/ui'
import {DropdownMenu} from 'alinea/ui/DropdownMenu'
import {Fragment, type ReactNode, useMemo} from 'react'
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
  icon: (ctx: RichTextToolbarContext) => ReactNode
  label?: ReactNode | ((ctx: RichTextToolbarContext) => ReactNode)
  items: ToolbarConfig | ((ctx: RichTextToolbarContext) => ToolbarConfig)
}

export interface ToolbarGroup {
  group: ToolbarConfig | ((ctx: RichTextToolbarContext) => ToolbarConfig)
}

export type ToolbarConfig = {
  [name: string]: ToolbarMenu | ToolbarButton | ToolbarGroup
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
  subMenu: boolean
}

function ToolbarButton({button, ctx, subMenu}: ToolbarButtonProps) {
  const icon = button.icon?.(ctx)
  const active = button.active?.(ctx)
  const disabled = button.disabled?.(ctx)
  const label =
    typeof button.label === 'function' ? button.label(ctx) : button.label
  const title = button.title ?? (typeof label === 'string' ? label : undefined)
  if (subMenu)
    return (
      <DropdownMenu.Item
        type="button"
        onClick={e => {
          e.preventDefault()
          button.onSelect(ctx)
        }}
        disabled={disabled}
      >
        <HStack gap={8} center>
          <Icon icon={icon} active={active} size={20} />
          {label}
        </HStack>
      </DropdownMenu.Item>
    )
  return (
    <IconButton
      icon={icon}
      size={18}
      onClick={e => {
        e.preventDefault()
        button.onSelect(ctx)
      }}
      disabled={disabled}
      active={active}
      title={title}
    />
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
          {icon && <Icon icon={icon} size={18} />}
          <span>{label}</span>
        </HStack>
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        <ToolbarItems
          subMenu
          config={config}
          ctx={ctx}
          separator={<HorizontalSeparator />}
        />
      </DropdownMenu.Items>
    </DropdownMenu.Root>
  )
}

interface ToolbarItemsProps {
  config: ToolbarConfig
  ctx: RichTextToolbarContext
  subMenu: boolean
  separator?: ReactNode
}

function ToolbarItems({config, ctx, subMenu, separator}: ToolbarItemsProps) {
  return values(config)
    .map(entry => {
      if ('items' in entry) {
        return <ToolbarMenu menu={entry} ctx={ctx} />
      } else if ('group' in entry) {
        const config =
          typeof entry.group === 'function' ? entry.group(ctx) : entry.group
        return <ToolbarItems subMenu={subMenu} config={config} ctx={ctx} />
      } else {
        return <ToolbarButton subMenu={subMenu} button={entry} ctx={ctx} />
      }
    })
    .reduce((result, node, index) => {
      if (index > 0)
        result.push(<Fragment key={`sep-${index}`}>{separator}</Fragment>)
      result.push(<Fragment key={`node-${index}`}>{node}</Fragment>)
      return result
    }, Array<ReactNode>())
}

function VerticalSeparator() {
  return <div className={styles.root.separator()} />
}

function HorizontalSeparator() {
  return (
    <hr
      style={{
        border: 'none',
        marginBlock: '2px',
        borderTop: '1px solid var(--alinea-outline)'
      }}
    />
  )
}

export function RichTextToolbar(props: RichTextToolbarProps) {
  const config: ToolbarConfig = useMemo(
    () => props.toolbar ?? defaultToolbar(props.enableTables || false),
    [props.toolbar, props.enableTables]
  )
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
        <ToolbarItems
          subMenu={false}
          config={config}
          ctx={ctx}
          separator={<VerticalSeparator />}
        />
      </HStack>
    </div>
  )
}
