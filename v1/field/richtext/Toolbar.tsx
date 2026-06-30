import {IcAlignCenter} from '#/ui/icons/IcAlignCenter.js'
import {IcAlignJustify} from '#/ui/icons/IcAlignJustify.js'
import {IcAlignLeft} from '#/ui/icons/IcAlignLeft.js'
import {IcAlignRight} from '#/ui/icons/IcAlignRight.js'
import {IcRoundFormatBold} from '#/ui/icons/IcRoundFormatBold.js'
import {IcRoundFormatClear} from '#/ui/icons/IcRoundFormatClear.js'
import {IcRoundFormatItalic} from '#/ui/icons/IcRoundFormatItalic.js'
import {IcRoundFormatListBulleted} from '#/ui/icons/IcRoundFormatListBulleted.js'
import {IcRoundFormatListNumbered} from '#/ui/icons/IcRoundFormatListNumbered.js'
import {IcRoundFormatPaint} from '#/ui/icons/IcRoundFormatPaint.js'
import {IcRoundHorizontalRule} from '#/ui/icons/IcRoundHorizontalRule.js'
import {IcRoundLink} from '#/ui/icons/IcRoundLink.js'
import {IcRoundQuote} from '#/ui/icons/IcRoundQuote.js'
import {IcRoundSubscript} from '#/ui/icons/IcRoundSubscript.js'
import {IcRoundSuperscript} from '#/ui/icons/IcRoundSuperscript.js'
import {IcRoundTextFields} from '#/ui/icons/IcRoundTextFields.js'
import {IcRoundUnfoldMore} from '#/ui/icons/IcRoundUnfoldMore.js'
import {TableDelete} from '#/ui/icons/TableDelete.js'
import {TableDeleteColumn} from '#/ui/icons/TableDeleteColumn.js'
import {TableDeleteRow} from '#/ui/icons/TableDeleteRow.js'
import {TableHeaderCell} from '#/ui/icons/TableHeaderCell.js'
import {TableHeaderColumn} from '#/ui/icons/TableHeaderColumn.js'
import {TableHeaderRow} from '#/ui/icons/TableHeaderRow.js'
import {TableInsert} from '#/ui/icons/TableInsert.js'
import {TableInsertColumnAfter} from '#/ui/icons/TableInsertColumnAfter.js'
import {TableInsertColumnBefore} from '#/ui/icons/TableInsertColumnBefore.js'
import {TableInsertRowAfter} from '#/ui/icons/TableInsertRowAfter.js'
import {TableInsertRowBefore} from '#/ui/icons/TableInsertRowBefore.js'
import {TableMergeCells} from '#/ui/icons/TableMergeCells.js'
import {TableSplitCell} from '#/ui/icons/TableSplitCell.js'
import {Typo} from '#/ui/Typo.js'
import type {
  ToolbarButton,
  ToolbarConfig,
  ToolbarGroup,
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
    styles: {
      group: {
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
    }
  }
} satisfies ToolbarMenu

export const tables = {
  icon: () => <IcRoundUnfoldMore />,
  label: 'Table',
  items(ctx) {
    const {editor, exec} = ctx
    if (!editor.isActive('table')) {
      return {
        insertTable: {
          icon: () => <TableInsert />,
          label: 'Insert table',
          onSelect: () =>
            exec().insertTable({rows: 3, cols: 3, withHeaderRow: true}).run()
        }
      }
    }
    const activeMenu: ToolbarConfig = {
      cells: {
        group: {
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
        group: {
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
        group: {
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
        group: {
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
  group: {
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
    },
    highlight: {
      icon: () => <IcRoundFormatPaint />,
      title: 'Highlight',
      active: ({editor}) => editor.isActive('highlight'),
      onSelect: ({exec}) => exec().toggleHighlight().run()
    }
  }
} satisfies ToolbarGroup

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
  group: {
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
} satisfies ToolbarGroup

export const links = {
  group: {
    link: {
      icon: () => <IcRoundLink />,
      title: 'Link',
      active: ({editor}) => editor.isActive('link'),
      onSelect: ({handleLink}) => handleLink()
    }
  }
} satisfies ToolbarGroup

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

export function defaultToolbar(enableTables: boolean): ToolbarConfig {
  if (!enableTables)
    return {
      headings,
      formatting,
      alignment,
      lists,
      links,
      quotes,
      inserts
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
