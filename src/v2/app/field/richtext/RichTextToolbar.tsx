import {
  Button,
  Menu,
  MenuItem,
  MenuSeparator,
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator
} from '@alinea/components'
import styler from '@alinea/styler'
import type {Editor} from '@tiptap/react'
import type {Reference} from 'alinea/core/Reference'
import {entries} from 'alinea/core/util/Objects'
import type {
  PickTextLinkFunc,
  PickerValue
} from 'alinea/field/richtext/PickTextLink'
import {
  attributesToReference,
  referenceToAttributes
} from 'alinea/field/richtext/ReferenceLink'
import type {
  RichTextToolbarContext,
  ToolbarButton,
  ToolbarConfig,
  ToolbarGroup as ToolbarConfigGroup,
  ToolbarMenu
} from 'alinea/field/richtext/RichTextToolbar'
import type {UrlReference} from 'alinea/picker/url'
import {memo, useMemo, type ReactNode} from 'react'
import {
  IcOutlineTableRows,
  IcRoundArrowDropDown,
  IcRoundFormatAlignCenter,
  IcRoundFormatAlignJustify,
  IcRoundFormatAlignLeft,
  IcRoundFormatAlignRight,
  IcRoundFormatBold,
  IcRoundFormatClear,
  IcRoundFormatItalic,
  IcRoundFormatListBulleted,
  IcRoundFormatListNumbered,
  IcRoundFormatPaint,
  IcRoundFormatQuote,
  IcRoundHorizontalRule,
  IcRoundLink,
  IcRoundSubscript,
  IcRoundSuperscript,
  IcRoundTextFields
} from '../../../icons.js'
import css from './RichTextToolbar.module.css'

const styles = styler(css)

const styleLabels = {
  paragraph: 'Normal text',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  h4: 'Heading 4',
  h5: 'Heading 5'
}

export type RichTextCommand = () => ReturnType<Editor['chain']>

export interface RichTextToolbarProps {
  editor: Editor
  enableTables?: boolean
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
        if (!picked || !picked.link) {
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
  pickLink,
  toolbar
}: RichTextToolbarProps) {
  const config = useMemo(
    () => toolbar ?? defaultToolbar(enableTables || false),
    [enableTables, toolbar]
  )
  const ctx = useMemo(() => {
    const exec = createToolbarExec(editor)
    return {
      editor,
      focusToggle: noop,
      pickLink: pickLink ?? pickBrowserLink,
      enableTables,
      exec,
      handleLink: createLinkHandler(editor, pickLink, exec),
      toolbar: config
    } satisfies RichTextToolbarContext
  }, [config, editor, enableTables, pickLink])
  return (
    <div className={styles.root()} data-richtext-toolbar="true">
      <Toolbar
        aria-label="Text formatting"
        className={styles.toolbar()}
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
      className={styles.button()}
    >
      {icon && <span className={styles.icon()}>{icon}</span>}
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
          className={styles.menuTrigger()}
        >
          {icon && <span className={styles.icon()}>{icon}</span>}
          {label && <span className={styles.menuText()}>{label}</span>}
          <span className={styles.icon()}>
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
        <span className={styles.menuItem()}>
          {icon && <span className={styles.icon()}>{icon}</span>}
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

function noop() {}

async function pickBrowserLink() {
  return undefined
}

const headings = {
  icon: () => <IcRoundTextFields />,
  label({editor}: RichTextToolbarContext) {
    const selected = editor.isActive('heading', {level: 1})
      ? 'h1'
      : editor.isActive('heading', {level: 2})
        ? 'h2'
        : editor.isActive('heading', {level: 3})
          ? 'h3'
          : editor.isActive('heading', {level: 4})
            ? 'h4'
            : editor.isActive('heading', {level: 5})
              ? 'h5'
              : 'paragraph'
    return styleLabels[selected as keyof typeof styleLabels]
  },
  items: {
    styles: {
      group: {
        normal: {
          label: 'Normal text',
          onSelect: ({exec}: RichTextToolbarContext) =>
            exec().clearNodes().run()
        },
        h1: {
          label: 'Heading 1',
          onSelect: ({exec}: RichTextToolbarContext) =>
            exec().setHeading({level: 1}).run()
        },
        h2: {
          label: 'Heading 2',
          onSelect: ({exec}: RichTextToolbarContext) =>
            exec().setHeading({level: 2}).run()
        },
        h3: {
          label: 'Heading 3',
          onSelect: ({exec}: RichTextToolbarContext) =>
            exec().setHeading({level: 3}).run()
        },
        h4: {
          label: 'Heading 4',
          onSelect: ({exec}: RichTextToolbarContext) =>
            exec().setHeading({level: 4}).run()
        },
        h5: {
          label: 'Heading 5',
          onSelect: ({exec}: RichTextToolbarContext) =>
            exec().setHeading({level: 5}).run()
        }
      }
    }
  }
} satisfies ToolbarMenu

const tables = {
  icon: () => <IcOutlineTableRows />,
  label: 'Table',
  items(ctx: RichTextToolbarContext) {
    const {editor, exec} = ctx
    if (!editor.isActive('table')) {
      const config: ToolbarConfig = {
        insertTable: {
          label: 'Insert table',
          onSelect: () =>
            exec().insertTable({rows: 3, cols: 3, withHeaderRow: true}).run()
        }
      }
      return config
    }
    const config: ToolbarConfig = {
      cells: {
        group: {
          mergeCells: {
            label: 'Merge cells',
            disabled: () => !editor.can().mergeCells(),
            onSelect: () => exec().mergeCells().run()
          },
          splitCell: {
            label: 'Split cell',
            disabled: () => !editor.can().splitCell(),
            onSelect: () => exec().splitCell().run()
          },
          headerCell: {
            label: 'Toggle header cell',
            onSelect: () => exec().toggleHeaderCell().run()
          }
        }
      },
      structure: {
        group: {
          addColumnBefore: {
            label: 'Insert column before',
            onSelect: () => exec().addColumnBefore().run()
          },
          addColumnAfter: {
            label: 'Insert column after',
            onSelect: () => exec().addColumnAfter().run()
          },
          toggleHeaderColumn: {
            label: 'Toggle header column',
            onSelect: () => exec().toggleHeaderColumn().run()
          },
          deleteColumn: {
            label: 'Delete column',
            onSelect: () => exec().deleteColumn().run()
          }
        }
      },
      rows: {
        group: {
          addRowBefore: {
            label: 'Insert row before',
            onSelect: () => exec().addRowBefore().run()
          },
          addRowAfter: {
            label: 'Insert row after',
            onSelect: () => exec().addRowAfter().run()
          },
          toggleHeaderRow: {
            label: 'Toggle header row',
            onSelect: () => exec().toggleHeaderRow().run()
          },
          deleteRow: {
            label: 'Delete row',
            onSelect: () => exec().deleteRow().run()
          }
        }
      },
      danger: {
        group: {
          deleteTable: {
            label: 'Delete table',
            onSelect: () => exec().deleteTable().run()
          }
        }
      }
    }
    return config
  }
} satisfies ToolbarMenu

const formatting = {
  group: {
    bold: {
      icon: () => <IcRoundFormatBold />,
      title: 'Bold',
      active: ({editor}: RichTextToolbarContext) => editor.isActive('bold'),
      onSelect: ({exec}: RichTextToolbarContext) => exec().toggleBold().run()
    },
    italic: {
      icon: () => <IcRoundFormatItalic />,
      title: 'Italic',
      active: ({editor}: RichTextToolbarContext) => editor.isActive('italic'),
      onSelect: ({exec}: RichTextToolbarContext) => exec().toggleItalic().run()
    },
    clear: {
      icon: () => <IcRoundFormatClear />,
      title: 'Clear format',
      onSelect: ({exec}: RichTextToolbarContext) => {
        exec().unsetAllMarks().run()
        exec().unsetTextAlign().run()
      }
    },
    small: {
      icon: () => <IcRoundTextFields />,
      title: 'Small',
      active: ({editor}: RichTextToolbarContext) => editor.isActive('small'),
      onSelect: ({exec}: RichTextToolbarContext) => exec().toggleSmall().run()
    },
    subscript: {
      icon: () => <IcRoundSubscript />,
      title: 'Subscript',
      active: ({editor}: RichTextToolbarContext) =>
        editor.isActive('subscript'),
      onSelect: ({exec}: RichTextToolbarContext) =>
        exec().toggleSubscript().run()
    },
    superscript: {
      icon: () => <IcRoundSuperscript />,
      title: 'Superscript',
      active: ({editor}: RichTextToolbarContext) =>
        editor.isActive('superscript'),
      onSelect: ({exec}: RichTextToolbarContext) =>
        exec().toggleSuperscript().run()
    },
    highlight: {
      icon: () => <IcRoundFormatPaint />,
      title: 'Highlight',
      active: ({editor}: RichTextToolbarContext) =>
        editor.isActive('highlight'),
      onSelect: ({exec}: RichTextToolbarContext) =>
        exec().toggleHighlight().run()
    }
  }
} satisfies ToolbarConfigGroup

const alignment = {
  icon({editor}: RichTextToolbarContext) {
    if (editor.isActive({textAlign: 'center'}))
      return <IcRoundFormatAlignCenter />
    if (editor.isActive({textAlign: 'right'}))
      return <IcRoundFormatAlignRight />
    if (editor.isActive({textAlign: 'justify'}))
      return <IcRoundFormatAlignJustify />
    return <IcRoundFormatAlignLeft />
  },
  label({editor}: RichTextToolbarContext) {
    if (editor.isActive({textAlign: 'center'})) return 'Center'
    if (editor.isActive({textAlign: 'right'})) return 'Right'
    if (editor.isActive({textAlign: 'justify'})) return 'Justify'
    return 'Left'
  },
  items: {
    left: {
      icon: () => <IcRoundFormatAlignLeft />,
      label: 'Left',
      active: ({editor}: RichTextToolbarContext) =>
        editor.isActive({textAlign: 'left'}),
      onSelect: ({exec}: RichTextToolbarContext) =>
        exec().setTextAlign('left').run()
    },
    center: {
      icon: () => <IcRoundFormatAlignCenter />,
      label: 'Center',
      active: ({editor}: RichTextToolbarContext) =>
        editor.isActive({textAlign: 'center'}),
      onSelect: ({exec}: RichTextToolbarContext) =>
        exec().setTextAlign('center').run()
    },
    right: {
      icon: () => <IcRoundFormatAlignRight />,
      label: 'Right',
      active: ({editor}: RichTextToolbarContext) =>
        editor.isActive({textAlign: 'right'}),
      onSelect: ({exec}: RichTextToolbarContext) =>
        exec().setTextAlign('right').run()
    },
    justify: {
      icon: () => <IcRoundFormatAlignJustify />,
      label: 'Justify',
      active: ({editor}: RichTextToolbarContext) =>
        editor.isActive({textAlign: 'justify'}),
      onSelect: ({exec}: RichTextToolbarContext) =>
        exec().setTextAlign('justify').run()
    }
  }
} satisfies ToolbarMenu

const lists = {
  group: {
    bulletList: {
      icon: () => <IcRoundFormatListBulleted />,
      title: 'Bullet list',
      active: ({editor}: RichTextToolbarContext) =>
        editor.isActive('bulletList'),
      onSelect: ({exec}: RichTextToolbarContext) =>
        exec().toggleBulletList().run()
    },
    orderedList: {
      icon: () => <IcRoundFormatListNumbered />,
      title: 'Ordered list',
      active: ({editor}: RichTextToolbarContext) =>
        editor.isActive('orderedList'),
      onSelect: ({exec}: RichTextToolbarContext) =>
        exec().toggleOrderedList().run()
    }
  }
} satisfies ToolbarConfigGroup

const links = {
  group: {
    link: {
      icon: () => <IcRoundLink />,
      title: 'Link',
      active: ({editor}: RichTextToolbarContext) => editor.isActive('link'),
      onSelect: ({handleLink}: RichTextToolbarContext) => handleLink()
    }
  }
} satisfies ToolbarConfigGroup

const quotes = {
  icon: () => <IcRoundFormatQuote />,
  title: 'Blockquote',
  active: ({editor}: RichTextToolbarContext) => editor.isActive('blockquote'),
  onSelect: ({exec}: RichTextToolbarContext) => exec().toggleBlockquote().run()
} satisfies ToolbarButton

const inserts = {
  icon: () => <IcRoundHorizontalRule />,
  title: 'Horizontal rule',
  onSelect: ({exec}: RichTextToolbarContext) => exec().setHorizontalRule().run()
} satisfies ToolbarButton

function defaultToolbar(enableTables: boolean): ToolbarConfig {
  if (!enableTables) {
    return {
      headings,
      formatting,
      alignment,
      lists,
      links,
      quotes,
      inserts
    }
  }
  return {
    headings,
    tables,
    formatting,
    alignment,
    lists,
    links,
    quotes,
    inserts
  }
}
