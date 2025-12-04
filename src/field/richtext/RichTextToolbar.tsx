/*import {IcRoundRedo} from 'alinea/ui/icons/IcRoundRedo'
import {IcRoundUndo} from 'alinea/ui/icons/IcRoundUndo'*/
import styler from '@alinea/styler'
import type {Editor} from '@tiptap/react'
import type {Reference} from 'alinea/core/Reference'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import type {UrlReference} from 'alinea/picker/url'
import {HStack, Icon, px} from 'alinea/ui'
import {DropdownMenu} from 'alinea/ui/DropdownMenu'
import {
  createContext,
  type ComponentType,
  type ReactNode,
  useContext,
  useMemo
} from 'react'
import type {PickTextLinkFunc} from './PickTextLink.js'
import {attributesToReference, referenceToAttributes} from './ReferenceLink.js'
import css from './RichTextToolbar.module.scss'
import {defaultToolbar} from './RichTextToolbar.preset.js'

const styles = styler(css)

export function RichTextToolbarSeparator() {
  return <div className={styles.root.separator()} />
}

export type RichTextCommand = () => ReturnType<Editor['chain']>

export type ToolbarButton = {
  icon?: ComponentType | ReactNode
  iconFromCtx?: (ctx: RichTextToolbarContext) => ComponentType | ReactNode
  label?: ReactNode | ((ctx: RichTextToolbarContext) => ReactNode)
  onSelect?: (ctx: RichTextToolbarContext) => void
  active?: (ctx: RichTextToolbarContext) => boolean
  disabled?: (ctx: RichTextToolbarContext) => boolean
  render?: (ctx: RichTextToolbarContext) => ReactNode
  size?: number
}

export type ToolbarMenu = {
  icon?: ComponentType | ReactNode
  iconFromCtx?: (ctx: RichTextToolbarContext) => ComponentType | ReactNode
  label?: ReactNode | ((ctx: RichTextToolbarContext) => ReactNode)
  items?: ToolbarConfig
  menu?: ToolbarConfig | ((ctx: RichTextToolbarContext) => ToolbarConfig)
  render?: (ctx: RichTextToolbarContext) => ReactNode
}

export type ToolbarSeparator = {separator: true}

export type ToolbarEntry =
  | ToolbarConfig
  | ToolbarButton
  | ToolbarMenu
  | ToolbarSeparator

export type ToolbarConfig = {
  [ns: string]: ToolbarEntry
}

export type RichTextToolbarProps = {
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

export type RichTextToolbarContext = {
  editor: Editor
  focusToggle: (target: EventTarget | null) => void
  pickLink: PickTextLinkFunc
  enableTables?: boolean
  exec: RichTextCommand
  handleLink: () => void
  toolbar: ToolbarConfig
}

const ToolbarContext = createContext<RichTextToolbarContext | null>(null)

export function useToolbar(): RichTextToolbarContext {
  const ctx = useContext(ToolbarContext)
  if (!ctx) throw new Error('RichTextToolbarProvider is missing')
  return ctx
}

export type RichTextToolbarProviderProps = RichTextToolbarProps & {
  children: ReactNode
}

export function RichTextToolbarProvider({
  editor,
  pickLink,
  focusToggle,
  enableTables,
  toolbar,
  children
}: RichTextToolbarProviderProps) {
  const exec = useMemo(() => createToolbarExec(editor), [editor])
  const handleLink = useMemo(
    () => createLinkHandler(editor, pickLink, exec),
    [editor, pickLink, exec]
  )
  const mergedToolbar = useMemo(
    () => ({...defaultToolbar, ...(toolbar ?? {})}),
    [toolbar]
  )
  const value = useMemo(
    () => ({
      editor,
      pickLink,
      focusToggle,
      enableTables,
      exec,
      handleLink,
      toolbar: mergedToolbar
    }),
    [
      editor,
      pickLink,
      focusToggle,
      enableTables,
      exec,
      handleLink,
      mergedToolbar
    ]
  )
  return (
    <ToolbarContext.Provider value={value}>{children}</ToolbarContext.Provider>
  )
}

export function RichTextToolbarRoot({children}: {children: ReactNode}) {
  const {focusToggle} = useToolbar()
  return (
    <div
      tabIndex={-1}
      className={styles.root()}
      data-richtext-toolbar="true"
      onFocus={e => focusToggle(e.currentTarget)}
      onBlur={e => focusToggle(e.relatedTarget)}
    >
      {children}
    </div>
  )
}

function isMenu(value: ToolbarEntry): value is ToolbarMenu {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('menu' in value || 'items' in value)
  )
}

function isButton(value: ToolbarEntry): value is ToolbarButton {
  return (
    typeof value === 'object' &&
    value !== null &&
    !isMenu(value) &&
    ('onSelect' in value ||
      'active' in value ||
      'disabled' in value ||
      'icon' in value ||
      'render' in value)
  )
}

function isSeparator(value: ToolbarEntry): value is ToolbarSeparator {
  return (
    typeof value === 'object' &&
    value !== null &&
    'separator' in value &&
    Object.keys(value).length === 1
  )
}

function resolveNode<T>(
  value: T | ((ctx: RichTextToolbarContext) => T),
  ctx: RichTextToolbarContext
): T {
  return typeof value === 'function' ? (value as any)(ctx) : value
}

function renderButton(
  key: string,
  config: ToolbarButton,
  ctx: RichTextToolbarContext
) {
  if (config.render) return <span key={key}>{config.render(ctx)}</span>
  const iconValue = config.iconFromCtx ? config.iconFromCtx(ctx) : config.icon
  const icon =
    typeof iconValue === 'function'
      ? (iconValue as ComponentType<any>)
      : undefined
  if (!icon) return null
  const active = config.active?.(ctx)
  const disabled = config.disabled?.(ctx)
  const label = resolveNode(config.label ?? '', ctx)
  const size = config.size ?? 18
  return (
    <IconButton
      key={key}
      icon={icon}
      size={size}
      title={typeof label === 'string' ? label : undefined}
      onClick={e => {
        e.preventDefault()
        config.onSelect?.(ctx)
      }}
      active={active}
      disabled={disabled}
    />
  )
}

function renderMenuItems(
  items: ToolbarConfig | undefined,
  ctx: RichTextToolbarContext
) {
  if (!items) return null
  const rendered: Array<ReactNode> = []
  Object.entries(items).forEach(([key, entry], idx) => {
    if (isMenu(entry)) return
    if (isSeparator(entry)) {
      rendered.push(
        <div
          key={`sep-${key}-${idx}`}
          style={{
            borderTop: '1px solid var(--alinea-outline)',
            margin: '4px 0'
          }}
        />
      )
      return
    }
    if (isButton(entry)) {
      if (entry.render) {
        rendered.push(<span key={key}>{entry.render(ctx)}</span>)
        return
      }
      const iconValue = entry.iconFromCtx ? entry.iconFromCtx(ctx) : entry.icon
      const icon =
        typeof iconValue === 'function'
          ? (iconValue as ComponentType<any>)
          : undefined
      const disabled = entry.disabled?.(ctx)
      const active = entry.active?.(ctx)
      const label = resolveNode(entry.label ?? key, ctx)
      rendered.push(
        <DropdownMenu.Item
          key={key}
          disabled={disabled}
          onClick={() => entry.onSelect?.(ctx)}
        >
          <HStack gap={8} center>
            {icon && <Icon icon={icon} active={active} />}
            {typeof label === 'string' || typeof label === 'number' ? (
              <span>{label}</span>
            ) : (
              label
            )}
          </HStack>
        </DropdownMenu.Item>
      )
      return
    }
    // Nested group inside menu: render its items with a separator before if needed
    const groupItems = renderMenuItems(entry as ToolbarConfig, ctx)
    if (groupItems) {
      if (rendered.length > 0) {
        rendered.push(
          <div
            key={`sep-group-${key}-${idx}`}
            style={{
              borderTop: '1px solid var(--alinea-outline)',
              margin: '4px 0'
            }}
          />
        )
      }
      rendered.push(<span key={`group-${key}-${idx}`}>{groupItems}</span>)
    }
  })
  return rendered
}

function renderMenu(
  key: string,
  menu: ToolbarMenu,
  ctx: RichTextToolbarContext
) {
  if (menu.render) return <span key={key}>{menu.render(ctx)}</span>
  const itemsConfig =
    menu.items ?? (menu.menu ? resolveNode(menu.menu, ctx) : undefined)
  if (!itemsConfig) return null
  const iconValue = menu.iconFromCtx ? menu.iconFromCtx(ctx) : menu.icon
  const iconComponent =
    typeof iconValue === 'function'
      ? (iconValue as ComponentType<any>)
      : undefined
  const label = resolveNode(menu.label ?? key, ctx)
  return (
    <DropdownMenu.Root key={key} top>
      <DropdownMenu.Trigger className={styles.root.dropdown()}>
        <HStack gap={10} center>
          {iconComponent && <Icon icon={iconComponent} />}
          <span>{label}</span>
        </HStack>
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        {renderMenuItems(itemsConfig, ctx)}
      </DropdownMenu.Items>
    </DropdownMenu.Root>
  )
}

function renderToolbarItems(
  config: ToolbarConfig,
  ctx: RichTextToolbarContext,
  insertSeparators = false
) {
  const entries = Object.entries(config)
  const rendered: Array<ReactNode> = []
  entries.forEach(([key, value], index) => {
    const node = isMenu(value) ? (
      renderMenu(key, value, ctx)
    ) : isButton(value) ? (
      renderButton(key, value, ctx)
    ) : isSeparator(value) ? (
      <RichTextToolbarSeparator key={key} />
    ) : (
      <HStack key={key} gap={10} center>
        {renderToolbarItems(value as ToolbarConfig, ctx)}
      </HStack>
    )
    if (!node) return
    if (insertSeparators && rendered.length > 0) {
      rendered.push(<RichTextToolbarSeparator key={`sep-${key}-${index}`} />)
    }
    rendered.push(node)
  })
  return rendered
}

function DefaultRichTextToolbarContent() {
  const ctx = useToolbar()
  const {enableTables, toolbar} = ctx
  if (!enableTables) {
    // If tables are disabled, drop table namespace
    const {table, ...rest} = toolbar
    return (
      <RichTextToolbarRoot>
        <HStack gap={10} center style={{height: '100%', padding: `${px(4)} 0`}}>
          {renderToolbarItems(rest, ctx, true)}
        </HStack>
      </RichTextToolbarRoot>
    )
  }
  return (
    <RichTextToolbarRoot>
      <HStack gap={10} center style={{height: '100%', padding: `${px(4)} 0`}}>
        {renderToolbarItems(toolbar, ctx, true)}
      </HStack>
    </RichTextToolbarRoot>
  )
}

export function RichTextToolbar(props: RichTextToolbarProps) {
  const context = useContext(ToolbarContext)
  if (context) {
    return <DefaultRichTextToolbarContent />
  }
  return (
    <RichTextToolbarProvider {...props}>
      <DefaultRichTextToolbarContent />
    </RichTextToolbarProvider>
  )
}
