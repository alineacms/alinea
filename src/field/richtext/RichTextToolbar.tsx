import {
  Button,
  Icon,
  Menu,
  MenuItem,
  MenuSeparator,
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator
} from '#/components.js'
import type {Reference} from '#/core/Reference.js'
import {entries} from '#/core/util/Objects.js'
import type {UrlReference} from '#/picker/url.js'
import {createUniqueAnchor, usedAnchors} from '#/core/util/Anchors.js'
import {slugify} from '#/core/util/Slugs.js'
import styler from '@alinea/styler'
import type {Editor} from '@tiptap/core'
import {useMemo, type ReactNode} from 'react'
import type {
  PickRichTextImageFunc,
  PickTextLinkFunc,
  PickerValue
} from './PickTextLink.js'
import {attributesToReference, referenceToAttributes} from './ReferenceLink.js'
import {currentAnchor} from './extensions/Anchor.js'
import {
  defaultToolbar,
  type RichTextToolbarContext,
  type ToolbarButton,
  type ToolbarConfig,
  type ToolbarGroup as ToolbarConfigGroup,
  type ToolbarMenu
} from './Toolbar.js'
import css from './RichTextToolbar.module.css'
import type {PickTextAnchorFunc} from './PickTextAnchor.js'

const styles = styler(css)

export interface RichTextToolbarProps {
  editor: Editor
  enableImages?: boolean
  enableTables?: boolean
  ownerId: string
  pickImage?: PickRichTextImageFunc
  pickLink?: PickTextLinkFunc
  pickAnchor?: PickTextAnchorFunc
  getEntryAnchors: () => Array<string>
  toolbar?: ToolbarConfig
  onFocusChange: (focused: boolean, nextTarget?: EventTarget | null) => void
}

export function RichTextToolbar({
  editor,
  enableImages,
  enableTables,
  ownerId,
  pickImage,
  pickLink,
  pickAnchor,
  getEntryAnchors,
  toolbar,
  onFocusChange
}: RichTextToolbarProps) {
  const config = useMemo(
    () => toolbar ?? defaultToolbar({enableImages, enableTables}),
    [enableImages, enableTables, toolbar]
  )
  const context = useMemo(() => {
    const exec = () => editor.chain().focus(null, {scrollIntoView: false})
    return {
      editor,
      enableImages,
      enableTables,
      exec,
      focusToggle: target => onFocusChange(Boolean(target)),
      pickImage: pickImage ?? emptyPicker,
      pickLink: pickLink ?? emptyPicker,
      handleImage: createImageHandler(editor, pickImage, exec),
      handleLink: createLinkHandler(editor, pickLink, exec),
      handleAnchor: pickAnchor
        ? createAnchorHandler(editor, pickAnchor, getEntryAnchors, exec)
        : () => undefined,
      toolbar: config
    } satisfies RichTextToolbarContext
  }, [
    config,
    editor,
    enableImages,
    enableTables,
    getEntryAnchors,
    onFocusChange,
    pickAnchor,
    pickImage,
    pickLink
  ])

  return (
    <div
      className={styles.RichTextToolbar()}
      data-richtext-toolbar="true"
      data-richtext-toolbar-owner={ownerId}
      onFocus={() => onFocusChange(true)}
      onBlur={event => onFocusChange(false, event.relatedTarget)}
    >
      <Toolbar aria-label="Text formatting">
        <ToolbarItems
          config={config}
          context={context}
          menu={false}
          ownerId={ownerId}
        />
      </Toolbar>
    </div>
  )
}

export function createImageHandler(
  editor: Editor,
  pickImage: PickRichTextImageFunc | undefined,
  exec: () => ReturnType<Editor['chain']>
) {
  return function handleImage() {
    if (!pickImage) return
    const existing = attributesToReference(editor.getAttributes('image'))
    void pickImage({link: existing})
      .then(picked => {
        if (picked === undefined) return
        if (!picked.link) {
          if (editor.isActive('image')) exec().deleteSelection().run()
          return
        }
        const link = picked.link
        if (link._type !== 'image' || !('_entry' in link)) return
        const attributes = {
          alt: picked.alt ?? '',
          height: null,
          src: picked.src ?? '',
          width: null,
          _id: link._id,
          _entry: link._entry,
          _link: 'image'
        }
        if (editor.isActive('image'))
          exec().updateAttributes('image', attributes).run()
        else exec().insertContent({type: 'image', attrs: attributes}).run()
      })
      .catch(console.error)
  }
}

interface ToolbarItemsProps {
  config: ToolbarConfig
  context: RichTextToolbarContext
  menu: boolean
  ownerId: string
}

function ToolbarItems({config, context, menu, ownerId}: ToolbarItemsProps) {
  return entries(config).flatMap(([name, entry], index) => {
    const separator =
      index === 0
        ? []
        : [
            menu ? (
              <MenuSeparator key={`${name}-separator`} />
            ) : (
              <ToolbarSeparator key={`${name}-separator`} />
            )
          ]
    return [...separator, renderEntry(name, entry, context, menu, ownerId)]
  })
}

function renderEntry(
  name: string,
  entry: ToolbarButton | ToolbarMenu | ToolbarConfigGroup,
  context: RichTextToolbarContext,
  menu: boolean,
  ownerId: string
): ReactNode {
  if ('items' in entry) {
    const label = resolve(entry.label, context)
    const items =
      typeof entry.items === 'function' ? entry.items(context) : entry.items
    return (
      <Menu
        key={name}
        aria-label={text(label) ?? humanize(name)}
        popoverProps={{'data-richtext-toolbar-owner': ownerId}}
        label={
          <Button appearance="plain">
            {entry.icon && <Icon icon={entry.icon(context)} data-slot="icon" />}
            {label}
          </Button>
        }
      >
        <ToolbarItems config={items} context={context} menu ownerId={ownerId} />
      </Menu>
    )
  }
  if ('group' in entry) {
    const group =
      typeof entry.group === 'function' ? entry.group(context) : entry.group
    const children = entries(group).map(([childName, child]) =>
      renderEntry(`${name}-${childName}`, child, context, menu, ownerId)
    )
    return menu ? children : <ToolbarGroup key={name}>{children}</ToolbarGroup>
  }
  const label = resolve(entry.label, context)
  const title = entry.title ?? text(label) ?? humanize(name)
  if (menu) {
    return (
      <MenuItem
        key={name}
        id={name}
        textValue={title}
        isDisabled={entry.disabled?.(context)}
        onAction={() => entry.onSelect(context)}
      >
        {entry.icon && <Icon icon={entry.icon(context)} data-slot="icon" />}
        <span>{label ?? title}</span>
      </MenuItem>
    )
  }
  return (
    <Button
      key={name}
      size="icon-nav"
      appearance={entry.active?.(context) ? 'active' : 'plain'}
      aria-label={title}
      isDisabled={entry.disabled?.(context)}
      onPress={() => entry.onSelect(context)}
    >
      {entry.icon ? (
        <Icon icon={entry.icon(context)} data-slot="icon" />
      ) : (
        label
      )}
    </Button>
  )
}

function createLinkHandler(
  editor: Editor,
  picker: PickTextLinkFunc | undefined,
  exec: () => ReturnType<Editor['chain']>
) {
  return function handleLink() {
    const attributes = editor.getAttributes('link')
    const {from, to} = editor.state.selection
    const selected = from !== to
    if (!picker) return browserLink(editor, exec, attributes, selected)
    const existing: Reference | undefined = attributesToReference(attributes)
    void picker({
      link: existing,
      title: attributes.title,
      blank: attributes.target === '_blank',
      hasLink: Boolean(existing),
      requireDescription: !selected
    }).then(picked => applyLink(editor, exec, picked, existing, selected))
  }
}

function createAnchorHandler(
  editor: Editor,
  picker: PickTextAnchorFunc,
  getEntryAnchors: () => Array<string>,
  exec: () => ReturnType<Editor['chain']>
) {
  return function handleAnchor() {
    void picker(currentAnchor(editor)).then(picked => {
      if (picked === undefined) return
      if (!picked.id) return void exec().unsetAnchor().run()
      const current = currentAnchor(editor)
      const anchor = createUniqueAnchor(
        slugify(picked.id),
        usedAnchors(getEntryAnchors(), current)
      )
      if (anchor) exec().setAnchor({id: anchor}).run()
    })
  }
}

function applyLink(
  editor: Editor,
  exec: () => ReturnType<Editor['chain']>,
  picked: PickerValue | undefined,
  existing: Reference | undefined,
  selected: boolean
) {
  if (picked === undefined) return
  if (!picked.link) return void exec().unsetLink().run()
  const attributes = {
    title: picked.title,
    ...referenceToAttributes(picked.link),
    target:
      (picked.link as UrlReference)._target ??
      (picked.blank ? '_blank' : undefined)
  }
  if (existing) exec().extendMarkRange('link').setLink(attributes).run()
  else if (selected) exec().setLink(attributes).run()
  else
    exec()
      .insertContent({
        type: 'text',
        text:
          picked.description ||
          (picked.link as UrlReference)._title ||
          (picked.link as UrlReference)._url ||
          '',
        marks: [{type: 'link', attrs: attributes}]
      })
      .run()
}

function browserLink(
  editor: Editor,
  exec: () => ReturnType<Editor['chain']>,
  attributes: Record<string, unknown>,
  selected: boolean
) {
  const href = window.prompt(
    'Enter link URL',
    typeof attributes.href === 'string' ? attributes.href : ''
  )
  if (href === null) return
  const value = href.trim()
  if (!value) return void exec().unsetLink().run()
  if (editor.isActive('link'))
    exec().extendMarkRange('link').setLink({href: value}).run()
  else if (selected) exec().setLink({href: value}).run()
  else
    exec()
      .insertContent({
        type: 'text',
        text: value,
        marks: [{type: 'link', attrs: {href: value}}]
      })
      .run()
}

function resolve(
  value: ToolbarButton['label'] | ToolbarMenu['label'],
  context: RichTextToolbarContext
) {
  return typeof value === 'function' ? value(context) : value
}

function text(value: ReactNode): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function humanize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/(^|\s)\w/g, letter => letter.toUpperCase())
}

async function emptyPicker(): Promise<undefined> {
  return undefined
}
