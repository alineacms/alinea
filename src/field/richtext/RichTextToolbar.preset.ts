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
import {Typo} from 'alinea/ui'
import type {RichTextToolbarContext, ToolbarConfig, ToolbarMenu} from './RichTextToolbar.js'
import {createElement} from 'react'

export const styleLabels = {
  paragraph: 'Normal text',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  h4: 'Heading 4',
  h5: 'Heading 5'
} as const

export const headings = {
  icon: IcRoundUnfoldMore,
  label({editor}: RichTextToolbarContext) {
    const selected =
      editor.isActive('heading', {level: 1}) ? 'h1' :
      editor.isActive('heading', {level: 2}) ? 'h2' :
      editor.isActive('heading', {level: 3}) ? 'h3' :
      editor.isActive('heading', {level: 4}) ? 'h4' :
      editor.isActive('heading', {level: 5}) ? 'h5' : 'paragraph'
    return styleLabels[selected as keyof typeof styleLabels]
  },
    menu: {
    normal: {
      label: () => createElement(Typo.P, null, 'Normal text'),
      onSelect: ({exec}: RichTextToolbarContext) => exec().clearNodes().run()
    },
    h1: {
      label: () => createElement(Typo.H1, {flat: true}, 'Heading 1'),
      onSelect: ({exec}: RichTextToolbarContext) =>
        exec().setHeading({level: 1}).run()
    },
    h2: {
      label: () => createElement(Typo.H2, {flat: true}, 'Heading 2'),
      onSelect: ({exec}: RichTextToolbarContext) =>
        exec().setHeading({level: 2}).run()
    },
    h3: {
      label: () => createElement(Typo.H3, {flat: true}, 'Heading 3'),
      onSelect: ({exec}: RichTextToolbarContext) =>
        exec().setHeading({level: 3}).run()
    },
    h4: {
      label: () => createElement(Typo.H4, {flat: true}, 'Heading 4'),
      onSelect: ({exec}: RichTextToolbarContext) =>
        exec().setHeading({level: 4}).run()
    },
    h5: {
      label: () => createElement(Typo.H5, {flat: true}, 'Heading 5'),
      onSelect: ({exec}: RichTextToolbarContext) =>
        exec().setHeading({level: 5}).run()
    }
  }
} satisfies ToolbarMenu

export const table = {
  icon: IcRoundUnfoldMore,
  label: 'Table',
  menu(ctx: RichTextToolbarContext) {
    const {editor, exec} = ctx
    if (!editor.isActive('table')) {
      const insertOnly: ToolbarConfig = {
        insertTable: {
          icon: TableInsert,
          label: 'Insert table',
          onSelect: () =>
            exec().insertTable({rows: 3, cols: 3, withHeaderRow: true}).run()
        }
      }
      return insertOnly
    }
    const activeMenu: ToolbarConfig = {
      mergeCells: {
        icon: TableMergeCells,
        label: 'Merge cells',
        disabled: () => !editor.can().mergeCells(),
        onSelect: () => exec().mergeCells().run()
      },
      splitCell: {
        icon: TableSplitCell,
        label: 'Split cell',
        disabled: () => !editor.can().splitCell(),
        onSelect: () => exec().splitCell().run()
      },
      headerCell: {
        icon: TableHeaderCell,
        label: 'Toggle header cell',
        onSelect: () => exec().toggleHeaderCell().run()
      },
      structure: {
        separator: true,
        addColumnBefore: {
          icon: TableInsertColumnBefore,
          label: 'Insert column before',
          onSelect: () => exec().addColumnBefore().run()
        },
        addColumnAfter: {
          icon: TableInsertColumnAfter,
          label: 'Insert column after',
          onSelect: () => exec().addColumnAfter().run()
        },
        toggleHeaderColumn: {
          icon: TableHeaderColumn,
          label: 'Toggle header column',
          onSelect: () => exec().toggleHeaderColumn().run()
        },
        deleteColumn: {
          icon: TableDeleteColumn,
          label: 'Delete column',
          onSelect: () => exec().deleteColumn().run()
        }
      },
      rows: {
        separator: true,
        addRowBefore: {
          icon: TableInsertRowBefore,
          label: 'Insert row before',
          onSelect: () => exec().addRowBefore().run()
        },
        addRowAfter: {
          icon: TableInsertRowAfter,
          label: 'Insert row after',
          onSelect: () => exec().addRowAfter().run()
        },
        toggleHeaderRow: {
          icon: TableHeaderRow,
          label: 'Toggle header row',
          onSelect: () => exec().toggleHeaderRow().run()
        },
        deleteRow: {
          icon: TableDeleteRow,
          label: 'Delete row',
          onSelect: () => exec().deleteRow().run()
        }
      },
      danger: {
        separator: true,
        deleteTable: {
          icon: TableDelete,
          label: 'Delete table',
          onSelect: () => exec().deleteTable().run()
        }
      }
    }
    return activeMenu
  }
} satisfies ToolbarMenu

export const formatting = {
  bold: {
    icon: IcRoundFormatBold,
    label: 'Bold',
    active: ({editor}: RichTextToolbarContext) => editor.isActive('bold'),
    onSelect: ({exec}: RichTextToolbarContext) => exec().toggleBold().run()
  },
  italic: {
    icon: IcRoundFormatItalic,
    label: 'Italic',
    active: ({editor}: RichTextToolbarContext) => editor.isActive('italic'),
    onSelect: ({exec}: RichTextToolbarContext) => exec().toggleItalic().run()
  },
  clear: {
    icon: IcRoundFormatClear,
    label: 'Clear format',
    onSelect: ({exec}: RichTextToolbarContext) => {
      exec().unsetAllMarks().run()
      exec().unsetTextAlign().run()
    }
  },
  small: {
    icon: IcRoundTextFields,
    label: 'Small',
    active: ({editor}: RichTextToolbarContext) => editor.isActive('small'),
    onSelect: ({exec}: RichTextToolbarContext) => exec().toggleSmall().run()
  },
  subscript: {
    icon: IcRoundSubscript,
    label: 'Subscript',
    active: ({editor}: RichTextToolbarContext) => editor.isActive('subscript'),
    onSelect: ({exec}: RichTextToolbarContext) => exec().toggleSubscript().run()
  },
  superscript: {
    icon: IcRoundSuperscript,
    label: 'Superscript',
    active: ({editor}: RichTextToolbarContext) => editor.isActive('superscript'),
    onSelect: ({exec}: RichTextToolbarContext) => exec().toggleSuperscript().run()
  }
} satisfies ToolbarConfig

export const alignment = {
  iconFromCtx({editor}: RichTextToolbarContext) {
    if (editor.isActive({textAlign: 'center'})) return IcAlignCenter
    if (editor.isActive({textAlign: 'right'})) return IcAlignRight
    if (editor.isActive({textAlign: 'justify'})) return IcAlignJustify
    return IcAlignLeft
  },
  menu: {
    left: {
      icon: IcAlignLeft,
      label: 'Left',
      active: ({editor}: RichTextToolbarContext) =>
        editor.isActive({textAlign: 'left'}),
      onSelect: ({exec}: RichTextToolbarContext) =>
        exec().setTextAlign('left').run()
    },
    center: {
      icon: IcAlignCenter,
      label: 'Center',
      active: ({editor}: RichTextToolbarContext) =>
        editor.isActive({textAlign: 'center'}),
      onSelect: ({exec}: RichTextToolbarContext) =>
        exec().setTextAlign('center').run()
    },
    right: {
      icon: IcAlignRight,
      label: 'Right',
      active: ({editor}: RichTextToolbarContext) =>
        editor.isActive({textAlign: 'right'}),
      onSelect: ({exec}: RichTextToolbarContext) =>
        exec().setTextAlign('right').run()
    },
    justify: {
      icon: IcAlignJustify,
      label: 'Justify',
      active: ({editor}: RichTextToolbarContext) =>
        editor.isActive({textAlign: 'justify'}),
      onSelect: ({exec}: RichTextToolbarContext) =>
        exec().setTextAlign('justify').run()
    }
  }
} satisfies ToolbarMenu

export const lists = {
  bulletList: {
    icon: IcRoundFormatListBulleted,
    label: 'Bullet list',
    active: ({editor}: RichTextToolbarContext) => editor.isActive('bulletList'),
    onSelect: ({exec}: RichTextToolbarContext) => exec().toggleBulletList().run()
  },
  orderedList: {
    icon: IcRoundFormatListNumbered,
    label: 'Ordered list',
    active: ({editor}: RichTextToolbarContext) => editor.isActive('orderedList'),
    onSelect: ({exec}: RichTextToolbarContext) =>
      exec().toggleOrderedList().run()
  }
} satisfies ToolbarConfig

export const links = {
  link: {
    icon: IcRoundLink,
    label: 'Link',
    active: ({editor}: RichTextToolbarContext) => editor.isActive('link'),
    onSelect: ({handleLink}: RichTextToolbarContext) => handleLink()
  }
} satisfies ToolbarConfig

export const quotes = {
  quote: {
    icon: IcRoundQuote,
    label: 'Blockquote',
    active: ({editor}: RichTextToolbarContext) => editor.isActive('blockquote'),
    onSelect: ({exec}: RichTextToolbarContext) => exec().toggleBlockquote().run()
  }
} satisfies ToolbarConfig

export const inserts = {
  horizontalRule: {
    icon: IcRoundHorizontalRule,
    label: 'Horizontal rule',
    onSelect: ({exec}: RichTextToolbarContext) => exec().setHorizontalRule().run()
  }
} satisfies ToolbarConfig

export const defaultToolbar: ToolbarConfig = {
  headings,
  table,
  formatting,
  alignment,
  lists,
  links,
  quotes,
  inserts
}
