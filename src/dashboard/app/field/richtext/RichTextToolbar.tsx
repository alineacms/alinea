import {
  Button,
  Menu,
  MenuItem,
  MenuSeparator,
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator
} from '#/components.js'
import type {Reference} from '#/core/Reference.js'
import {entries} from '#/core/util/Objects.js'
import type {
  PickTextLinkFunc,
  PickerValue
} from '#/field/richtext/PickTextLink.js'
import {
  attributesToReference,
  referenceToAttributes
} from '#/field/richtext/ReferenceLink.js'
import type {
  RichTextToolbarContext,
  ToolbarButton,
  ToolbarConfig,
  ToolbarGroup as ToolbarConfigGroup,
  ToolbarMenu
} from '#/field/richtext/RichTextToolbar.js'
import type {UrlReference} from '#/picker/url.js'
import styler from '@alinea/styler'
import type {Editor} from '@tiptap/react'
import {memo, useEffect, useMemo, useReducer, type ReactNode} from 'react'
import {IcRoundArrowDropDown} from '../../../icons.js'
import css from './RichTextToolbar.module.css'
import {defaultToolbar} from './Toolbar.js'

const styles = styler(css)

export type RichTextCommand = () => ReturnType<Editor['chain']>

export interface RichTextToolbarProps {
  editor: Editor
  enableTables?: boolean
  focusToggle: (target: EventTarget | null) => void
  pickLink?: PickTextLinkFunc
  toolbar?: ToolbarConfig
}

export function createToolbarExec(editor: Editor): RichTextCommand {
  return () => editor.chain().focus(null, {scrollIntoView: false})
}

export function createLinkHandler(
  editor: Editor,
  pickLink: PickTextLinkFunc | undefined,
  exec = createToolbarExec(editor)
) {
  return function handleLink() {
    const attrs = editor.getAttributes('link')
    const {view} = editor
    const {from, to} = view.state.selection
    const isSelection = from !== to
    if (!pickLink) return handleBrowserLink(editor, exec, attrs, isSelection)
    const existing: Reference | undefined = attributesToReference(attrs)
    return pickLink({
      link: existing,
      title: attrs.title,
      blank: attrs.target === '_blank',
      hasLink: Boolean(existing),
      requireDescription: !isSelection
    })
      .then(picked => {
        if (picked === undefined) return
        if (!picked.link) {
          exec().unsetLink().run()
          return
        }
        const linkAttributes = createLinkAttributes(picked)
        if (existing) {
          exec().extendMarkRange('link').setLink(linkAttributes).run()
        } else if (isSelection) {
          exec().setLink(linkAttributes).run()
        } else {
          exec()
            .insertContent({
              type: 'text',
              text:
                picked.title ||
                (picked.link as UrlReference)._title ||
                (picked.link as UrlReference)._url ||
                '',
              marks: [{type: 'link', attrs: linkAttributes}]
            })
            .run()
        }
      })
      .catch(console.error)
  }
}

export const RichTextToolbar = memo(function RichTextToolbar({
  editor,
  enableTables,
  focusToggle,
  pickLink,
  toolbar
}: RichTextToolbarProps) {
  const [, forceUpdate] = useReducer(value => value + 1, 0)
  useEffect(() => {
    editor.on('transaction', forceUpdate)
    return () => {
      editor.off('transaction', forceUpdate)
    }
  }, [editor])
  const config = useMemo(
    () => toolbar ?? defaultToolbar(enableTables || false),
    [enableTables, toolbar]
  )
  const ctx = useMemo(() => {
    const exec = createToolbarExec(editor)
    return {
      editor,
      focusToggle,
      pickLink: pickLink ?? pickBrowserLink,
      enableTables,
      exec,
      handleLink: createLinkHandler(editor, pickLink, exec),
      toolbar: config
    } satisfies RichTextToolbarContext
  }, [config, editor, enableTables, focusToggle, pickLink])
  return (
    <div
      tabIndex={-1}
      className={styles.RichTextToolbar()}
      data-richtext-toolbar="true"
      onFocus={event => ctx.focusToggle(event.currentTarget)}
      onBlur={event => ctx.focusToggle(event.relatedTarget)}
    >
      <Toolbar
        aria-label="Text formatting"
        className={styles.RichTextToolbar.toolbar()}
        data-orientation="horizontal"
      >
        <ToolbarItems config={config} ctx={ctx} subMenu={false} />
      </Toolbar>
    </div>
  )
})

interface ToolbarButtonProps {
  button: ToolbarButton
  ctx: RichTextToolbarContext
}

function ToolbarButtonView({button, ctx}: ToolbarButtonProps) {
  const icon = button.icon?.(ctx)
  const label = resolveNode(button.label, ctx)
  const active = button.active?.(ctx)
  const title = button.title ?? (typeof label === 'string' ? label : undefined)
  return (
    <Button
      size="square-petite"
      appearance={active ? 'active' : 'plain'}
      isDisabled={button.disabled?.(ctx)}
      onPress={() => button.onSelect(ctx)}
      aria-label={title}
      className={styles.ToolbarButtonView()}
    >
      {icon && <span className={styles.ToolbarButtonView.icon()}>{icon}</span>}
      {!icon && label}
    </Button>
  )
}

interface ToolbarMenuProps {
  ctx: RichTextToolbarContext
  menu: ToolbarMenu
}

function ToolbarMenuView({ctx, menu}: ToolbarMenuProps) {
  const icon = menu.icon?.(ctx)
  const label = resolveNode(menu.label, ctx)
  const config = typeof menu.items === 'function' ? menu.items(ctx) : menu.items
  const textValue = getTextValue(label) ?? 'Menu'
  return (
    <Menu
      aria-label={textValue}
      label={
        <Button
          appearance="plain"
          size="small"
          className={styles.ToolbarMenuView.trigger()}
        >
          {icon && (
            <span className={styles.ToolbarMenuView.icon()}>{icon}</span>
          )}
          {label && (
            <span className={styles.ToolbarMenuView.text()}>{label}</span>
          )}
          <span className={styles.ToolbarMenuView.icon()}>
            <IcRoundArrowDropDown />
          </span>
        </Button>
      }
    >
      <ToolbarItems config={config} ctx={ctx} subMenu={true} />
    </Menu>
  )
}

interface ToolbarItemsProps {
  config: ToolbarConfig
  ctx: RichTextToolbarContext
  subMenu: boolean
}

function ToolbarItems({config, ctx, subMenu}: ToolbarItemsProps) {
  return entries(config).reduce((result, [name, entry], index) => {
    if (index > 0) {
      result.push(
        subMenu ? (
          <MenuSeparator key={`${name}-separator`} />
        ) : (
          <ToolbarSeparator key={`${name}-separator`} />
        )
      )
    }
    result.push(renderEntry(name, entry, ctx, subMenu))
    return result
  }, Array<ReactNode>())
}

function renderEntry(
  name: string,
  entry: ToolbarButton | ToolbarMenu | ToolbarConfigGroup,
  ctx: RichTextToolbarContext,
  subMenu: boolean
): ReactNode {
  if ('items' in entry) {
    return <ToolbarMenuView key={name} menu={entry} ctx={ctx} />
  }
  if ('group' in entry) {
    const config =
      typeof entry.group === 'function' ? entry.group(ctx) : entry.group
    const content: Array<ReactNode> = entries(config).map(
      ([groupName, groupEntry]) =>
        renderEntry(`${name}-${groupName}`, groupEntry, ctx, subMenu)
    )
    if (subMenu) return content
    return <ToolbarGroup key={name}>{content}</ToolbarGroup>
  }
  if (subMenu) {
    const label = resolveNode(entry.label, ctx)
    const title =
      entry.title ?? getTextValue(label) ?? humanizeToolbarName(name)
    const icon = entry.icon?.(ctx)
    return (
      <MenuItem
        key={name}
        id={name}
        textValue={title}
        isDisabled={entry.disabled?.(ctx)}
        onAction={() => entry.onSelect(ctx)}
      >
        <span className={styles.ToolbarMenuView.item()}>
          {icon && (
            <span className={styles.ToolbarMenuView.icon()}>{icon}</span>
          )}
          <span>{label ?? title}</span>
        </span>
      </MenuItem>
    )
  }
  return <ToolbarButtonView key={name} button={entry} ctx={ctx} />
}

function handleBrowserLink(
  editor: Editor,
  exec: RichTextCommand,
  attrs: Record<string, unknown>,
  isSelection: boolean
) {
  if (typeof window === 'undefined') return
  const currentHref = typeof attrs.href === 'string' ? attrs.href : ''
  const href = window.prompt('Enter link URL', currentHref)
  if (href === null) return
  const nextHref = href.trim()
  if (!nextHref) {
    exec().unsetLink().run()
    return
  }
  const linkAttributes = {href: nextHref}
  if (editor.isActive('link')) {
    exec().extendMarkRange('link').setLink(linkAttributes).run()
  } else if (isSelection) {
    exec().setLink(linkAttributes).run()
  } else {
    exec()
      .insertContent({
        type: 'text',
        text: nextHref,
        marks: [{type: 'link', attrs: linkAttributes}]
      })
      .run()
  }
}

function createLinkAttributes(picked: PickerValue) {
  const link = picked.link!
  return {
    title: picked.title,
    ...referenceToAttributes(link),
    target:
      (link as UrlReference)._target ?? (picked.blank ? '_blank' : undefined)
  }
}

function resolveNode(
  value: ToolbarButton['label'] | ToolbarMenu['label'],
  ctx: RichTextToolbarContext
) {
  return typeof value === 'function' ? value(ctx) : value
}

function getTextValue(value: ReactNode) {
  return typeof value === 'string' ? value : undefined
}

function humanizeToolbarName(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/(^|\s)\w/g, letter => letter.toUpperCase())
}

async function pickBrowserLink() {
  return undefined
}
