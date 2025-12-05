import {IcAlignCenter} from 'alinea/ui/icons/IcAlignCenter'
import {IcAlignJustify} from 'alinea/ui/icons/IcAlignJustify'
import {IcAlignLeft} from 'alinea/ui/icons/IcAlignLeft'
import {IcAlignRight} from 'alinea/ui/icons/IcAlignRight'
import {IcRoundFormatBold} from 'alinea/ui/icons/IcRoundFormatBold'
import {IcRoundFormatClear} from 'alinea/ui/icons/IcRoundFormatClear'
import {IcRoundFormatItalic} from 'alinea/ui/icons/IcRoundFormatItalic'
import {IcRoundFormatListBulleted} from 'alinea/ui/icons/IcRoundFormatListBulleted'
import {IcRoundFormatListNumbered} from 'alinea/ui/icons/IcRoundFormatListNumbered'
import {IcRoundHorizontalRule} from 'alinea/ui/icons/IcRoundHorizontalRule'
import {IcRoundLink} from 'alinea/ui/icons/IcRoundLink'
import {IcRoundQuote} from 'alinea/ui/icons/IcRoundQuote'
import {IcRoundSubscript} from 'alinea/ui/icons/IcRoundSubscript'
import {IcRoundSuperscript} from 'alinea/ui/icons/IcRoundSuperscript'
import {IcRoundTextFields} from 'alinea/ui/icons/IcRoundTextFields'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {TableDelete} from 'alinea/ui/icons/TableDelete'
import {TableDeleteColumn} from 'alinea/ui/icons/TableDeleteColumn'
import {TableDeleteRow} from 'alinea/ui/icons/TableDeleteRow'
import {TableHeaderCell} from 'alinea/ui/icons/TableHeaderCell'
import {TableHeaderColumn} from 'alinea/ui/icons/TableHeaderColumn'
import {TableHeaderRow} from 'alinea/ui/icons/TableHeaderRow'
import {TableInsert} from 'alinea/ui/icons/TableInsert'
import {TableInsertColumnAfter} from 'alinea/ui/icons/TableInsertColumnAfter'
import {TableInsertColumnBefore} from 'alinea/ui/icons/TableInsertColumnBefore'
import {TableInsertRowAfter} from 'alinea/ui/icons/TableInsertRowAfter'
import {TableInsertRowBefore} from 'alinea/ui/icons/TableInsertRowBefore'
import {TableMergeCells} from 'alinea/ui/icons/TableMergeCells'
import {TableSplitCell} from 'alinea/ui/icons/TableSplitCell'
import {Typo} from 'alinea/ui/Typo'
import type {
  ToolbarButton,
  ToolbarConfig,
  ToolbarMenu
} from './RichTextToolbar.js'

const styleLabels = {
  paragraph: 'Normal text',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  h4: 'Heading 4',
  h5: 'Heading 5'
}

export const headings = {
  icon: () => <IcRoundUnfoldMore />,
  label({editor}) {
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
    normal: {
      label: () => <Typo.P flat>Normal text</Typo.P>,
      onSelect: ({exec}) => exec().clearNodes().run()
    },
    h1: {
      label: () => <Typo.H1 flat>Heading 1</Typo.H1>,
      onSelect: ({exec}) => exec().setHeading({level: 1}).run()
    },
    h2: {
      label: () => <Typo.H2 flat>Heading 2</Typo.H2>,
      onSelect: ({exec}) => exec().setHeading({level: 2}).run()
    },
    h3: {
      label: () => <Typo.H3 flat>Heading 3</Typo.H3>,
      onSelect: ({exec}) => exec().setHeading({level: 3}).run()
    },
    h4: {
      label: () => <Typo.H4 flat>Heading 4</Typo.H4>,
      onSelect: ({exec}) => exec().setHeading({level: 4}).run()
    },
    h5: {
      label: () => <Typo.H5 flat>Heading 5</Typo.H5>,
      onSelect: ({exec}) => exec().setHeading({level: 5}).run()
    }
  }
} satisfies ToolbarMenu

export const tables = {
  icon: () => <IcRoundUnfoldMore />,
  label: 'Table',
  items(ctx) {
    const {editor, exec} = ctx
    if (!editor.isActive('table')) {
      const insertOnly: ToolbarConfig = {
        insertTable: {
          icon: () => <TableInsert />,
          label: 'Insert table',
          onSelect: () =>
            exec().insertTable({rows: 3, cols: 3, withHeaderRow: true}).run()
        }
      }
      return insertOnly
    }
    const activeMenu: ToolbarConfig = {
      cells: {
        items: {
          mergeCells: {
            icon: () => <TableMergeCells />,
            label: 'Merge cells',
            disabled: () => !editor.can().mergeCells(),
            onSelect: () => exec().mergeCells().run()
          },
          splitCell: {
            icon: () => <TableSplitCell />,
            label: 'Split cell',
            disabled: () => !editor.can().splitCell(),
            onSelect: () => exec().splitCell().run()
          },
          headerCell: {
            icon: () => <TableHeaderCell />,
            label: 'Toggle header cell',
            onSelect: () => exec().toggleHeaderCell().run()
          }
        }
      },
      structure: {
        items: {
          addColumnBefore: {
            icon: () => <TableInsertColumnBefore />,
            label: 'Insert column before',
            onSelect: () => exec().addColumnBefore().run()
          },
          addColumnAfter: {
            icon: () => <TableInsertColumnAfter />,
            label: 'Insert column after',
            onSelect: () => exec().addColumnAfter().run()
          },
          toggleHeaderColumn: {
            icon: () => <TableHeaderColumn />,
            label: 'Toggle header column',
            onSelect: () => exec().toggleHeaderColumn().run()
          },
          deleteColumn: {
            icon: () => <TableDeleteColumn />,
            label: 'Delete column',
            onSelect: () => exec().deleteColumn().run()
          }
        }
      },
      rows: {
        items: {
          addRowBefore: {
            icon: () => <TableInsertRowBefore />,
            label: 'Insert row before',
            onSelect: () => exec().addRowBefore().run()
          },
          addRowAfter: {
            icon: () => <TableInsertRowAfter />,
            label: 'Insert row after',
            onSelect: () => exec().addRowAfter().run()
          },
          toggleHeaderRow: {
            icon: () => <TableHeaderRow />,
            label: 'Toggle header row',
            onSelect: () => exec().toggleHeaderRow().run()
          },
          deleteRow: {
            icon: () => <TableDeleteRow />,
            label: 'Delete row',
            onSelect: () => exec().deleteRow().run()
          }
        }
      },
      danger: {
        items: {
          deleteTable: {
            icon: () => <TableDelete />,
            label: 'Delete table',
            onSelect: () => exec().deleteTable().run()
          }
        }
      }
    }
    return activeMenu
  }
} satisfies ToolbarMenu

export const formatting = {
  items: {
    bold: {
      icon: () => <IcRoundFormatBold />,
      title: 'Bold',
      active: ({editor}) => editor.isActive('bold'),
      onSelect: ({exec}) => exec().toggleBold().run()
    },
    italic: {
      icon: () => <IcRoundFormatItalic />,
      title: 'Italic',
      active: ({editor}) => editor.isActive('italic'),
      onSelect: ({exec}) => exec().toggleItalic().run()
    },
    clear: {
      icon: () => <IcRoundFormatClear />,
      title: 'Clear format',
      onSelect: ({exec}) => {
        exec().unsetAllMarks().run()
        exec().unsetTextAlign().run()
      }
    },
    small: {
      icon: () => <IcRoundTextFields />,
      title: 'Small',
      active: ({editor}) => editor.isActive('small'),
      onSelect: ({exec}) => exec().toggleSmall().run()
    },
    subscript: {
      icon: () => <IcRoundSubscript />,
      title: 'Subscript',
      active: ({editor}) => editor.isActive('subscript'),
      onSelect: ({exec}) => exec().toggleSubscript().run()
    },
    superscript: {
      icon: () => <IcRoundSuperscript />,
      title: 'Superscript',
      active: ({editor}) => editor.isActive('superscript'),
      onSelect: ({exec}) => exec().toggleSuperscript().run()
    }
  }
} satisfies ToolbarMenu

export const alignment = {
  icon({editor}) {
    if (editor.isActive({textAlign: 'center'})) return <IcAlignCenter />
    if (editor.isActive({textAlign: 'right'})) return <IcAlignRight />
    if (editor.isActive({textAlign: 'justify'})) return <IcAlignJustify />
    return <IcAlignLeft />
  },
  items: {
    left: {
      icon: () => <IcAlignLeft />,
      label: 'Left',
      active: ({editor}) => editor.isActive({textAlign: 'left'}),
      onSelect: ({exec}) => exec().setTextAlign('left').run()
    },
    center: {
      icon: () => <IcAlignCenter />,
      label: 'Center',
      active: ({editor}) => editor.isActive({textAlign: 'center'}),
      onSelect: ({exec}) => exec().setTextAlign('center').run()
    },
    right: {
      icon: () => <IcAlignRight />,
      label: 'Right',
      active: ({editor}) => editor.isActive({textAlign: 'right'}),
      onSelect: ({exec}) => exec().setTextAlign('right').run()
    },
    justify: {
      icon: () => <IcAlignJustify />,
      label: 'Justify',
      active: ({editor}) => editor.isActive({textAlign: 'justify'}),
      onSelect: ({exec}) => exec().setTextAlign('justify').run()
    }
  }
} satisfies ToolbarMenu

export const lists = {
  items: {
    bulletList: {
      icon: () => <IcRoundFormatListBulleted />,
      title: 'Bullet list',
      active: ({editor}) => editor.isActive('bulletList'),
      onSelect: ({exec}) => exec().toggleBulletList().run()
    },
    orderedList: {
      icon: () => <IcRoundFormatListNumbered />,
      title: 'Ordered list',
      active: ({editor}) => editor.isActive('orderedList'),
      onSelect: ({exec}) => exec().toggleOrderedList().run()
    }
  }
} satisfies ToolbarMenu

export const links = {
  items: {
    link: {
      icon: () => <IcRoundLink />,
      title: 'Link',
      active: ({editor}) => editor.isActive('link'),
      onSelect: ({handleLink}) => handleLink()
    }
  }
} satisfies ToolbarMenu

export const quotes = {
  icon: () => <IcRoundQuote />,
  title: 'Blockquote',
  active: ({editor}) => editor.isActive('blockquote'),
  onSelect: ({exec}) => exec().toggleBlockquote().run()
} satisfies ToolbarButton

export const inserts = {
  icon: () => <IcRoundHorizontalRule />,
  title: 'Horizontal rule',
  onSelect: ({exec}) => exec().setHorizontalRule().run()
} satisfies ToolbarButton

export const defaultToolbar = {
  headings,
  formatting,
  alignment,
  lists,
  links,
  quotes,
  inserts
} satisfies ToolbarConfig
