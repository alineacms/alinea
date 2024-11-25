import {Reference} from 'alinea/core/Reference'
import {UrlReference} from 'alinea/picker/url'
import {HStack, Icon, px, Typo} from 'alinea/ui'
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
import {IcRoundTextFields} from 'alinea/ui/icons/IcRoundTextFields'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
/*import {IcRoundRedo} from 'alinea/ui/icons/IcRoundRedo'
import {IcRoundUndo} from 'alinea/ui/icons/IcRoundUndo'*/
import styler from '@alinea/styler'
import {Level} from '@tiptap/extension-heading'
import {Editor} from '@tiptap/react'
import {FieldToolbar} from 'alinea/dashboard/view/entry/FieldToolbar'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import {IcRoundSubscript} from 'alinea/ui/icons/IcRoundSubscript'
import {IcRoundSuperscript} from 'alinea/ui/icons/IcRoundSuperscript'
import {TableDelete} from 'alinea/ui/icons/TableDelete'
import {TableDeleteColumn} from 'alinea/ui/icons/TableDeleteColumn'
import {TableDeleteRow} from 'alinea/ui/icons/TableDeleteRow'
import {TableHeaderRow} from 'alinea/ui/icons/TableHeaderRow'
import {TableInsert} from 'alinea/ui/icons/TableInsert'
import {TableInsertColumnAfter} from 'alinea/ui/icons/TableInsertColumnAfter'
import {TableInsertColumnBefore} from 'alinea/ui/icons/TableInsertColumnBefore'
import {TableInsertRowAfter} from 'alinea/ui/icons/TableInsertRowAfter'
import {TableInsertRowBefore} from 'alinea/ui/icons/TableInsertRowBefore'
import {Menu, MenuItem} from 'alinea/ui/Menu'
import {forwardRef, Ref} from 'react'
import {PickTextLinkFunc} from './PickTextLink.js'
import {attributesToReference, referenceToAttributes} from './ReferenceLink.js'
import css from './RichTextToolbar.module.scss'

const styles = styler(css)

enum Styles {
  paragraph = 'Normal text',
  h1 = 'Heading 1',
  h2 = 'Heading 2',
  h3 = 'Heading 3',
  h4 = 'Heading 4',
  h5 = 'Heading 5'
}

const HrDivider = () => (
  <hr
    style={{
      border: 'none',
      marginBlock: '2px',
      borderTop: '1px solid var(--alinea-outline)'
    }}
  />
)

export type RichTextToolbarProps = {
  editor: Editor
  focusToggle: (target: EventTarget | null) => void
  pickLink: PickTextLinkFunc
  enableTables?: boolean
}

export const RichTextToolbar = forwardRef(function RichTextToolbar(
  {pickLink, editor, focusToggle, enableTables}: RichTextToolbarProps,
  ref: Ref<HTMLDivElement>
) {
  function exec() {
    return editor.chain().focus(null, {scrollIntoView: false})
  }
  const selectedStyle = editor.isActive('heading', {level: 1})
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

  const selectedTable = editor.isActive('table')

  function handleLink() {
    const attrs = editor.getAttributes('link')
    const existing: Reference | undefined = attributesToReference(attrs)
    const {view, state} = editor
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
        const attrs = {
          title: picked.title,
          ...referenceToAttributes(link),
          target:
            (link as UrlReference)._target ??
            (picked.blank ? '_blank' : undefined)
        }
        if (existing) {
          exec().extendMarkRange('link').setLink(attrs).run()
        } else if (isSelection) {
          // Try creating a link on selected text
          exec()
            .setLink(attrs as any)
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
              marks: [{type: 'link', attrs}]
            })
            .run()
        }
      })
      .catch(console.error)
  }
  return (
    <FieldToolbar.Slot>
      <div
        ref={ref}
        tabIndex={-1}
        className={styles.root()}
        onFocus={e => focusToggle(e.currentTarget)}
        onBlur={e => focusToggle(e.relatedTarget)}
      >
        <HStack gap={10} center style={{height: '100%', padding: `${px(4)} 0`}}>
          <Menu
            label={
              <HStack gap={10} center className={styles.root.dropdown()}>
                <span>{Styles[selectedStyle]}</span>
                <Icon icon={IcRoundUnfoldMore} />
              </HStack>
            }
            onAction={id => {
              if (typeof id !== 'string') return
              if (id === 'paragraph') return exec().clearNodes().run()
              const level = parseInt(id.slice(1)) as Level
              exec().setHeading({level}).run()
            }}
          >
            <MenuItem id="paragraph">
              <Typo.P>Normal text</Typo.P>
            </MenuItem>
            <MenuItem id="h1">
              <Typo.H1 flat>Heading 1</Typo.H1>
            </MenuItem>
            <MenuItem id="h2">
              <Typo.H2 flat>Heading 2</Typo.H2>
            </MenuItem>
            <MenuItem id="h3">
              <Typo.H3 flat>Heading 3</Typo.H3>
            </MenuItem>
            <MenuItem id="h4">
              <Typo.H4 flat>Heading 4</Typo.H4>
            </MenuItem>
            <MenuItem id="h5">
              <Typo.H5 flat>Heading 5</Typo.H5>
            </MenuItem>
          </Menu>
          {enableTables && (
            <Menu
              label={
                <HStack gap={10} center className={styles.root.dropdown()}>
                  <span>Table</span>
                  <Icon icon={IcRoundUnfoldMore} />
                </HStack>
              }
            >
              {selectedTable ? (
                <>
                  <MenuItem
                    id="addRowBefore"
                    //onClick={() => exec().addRowBefore().run()}
                  >
                    <HStack gap={8} center>
                      <Icon icon={TableInsertRowBefore} size={20} />
                      Insert row before
                    </HStack>
                  </MenuItem>
                  <MenuItem
                    id="addRowAfter"
                    //onClick={() => exec().addRowAfter().run()}
                  >
                    <HStack gap={8} center>
                      <Icon icon={TableInsertRowAfter} size={20} />
                      Insert row after
                    </HStack>
                  </MenuItem>
                  <MenuItem
                    id="deleteRow"
                    //onClick={() => exec().deleteRow().run()}
                  >
                    <HStack gap={8} center>
                      <Icon icon={TableDeleteRow} size={20} />
                      Delete row
                    </HStack>
                  </MenuItem>
                  <MenuItem
                    id="toggleHeaderRow"
                    //onClick={() => exec().toggleHeaderRow().run()}
                  >
                    <HStack gap={8} center>
                      <Icon icon={TableHeaderRow} size={20} />
                      Toggle header row
                    </HStack>
                  </MenuItem>
                  <HrDivider />
                  <MenuItem
                    id="addColumnBefore"
                    //onClick={() => exec().addColumnBefore().run()}
                  >
                    <HStack gap={8} center>
                      <Icon icon={TableInsertColumnBefore} size={20} />
                      Insert column before
                    </HStack>
                  </MenuItem>
                  <MenuItem
                    id="addColumnAfter"
                    // onClick={() => exec().addColumnAfter().run()}
                  >
                    <HStack gap={8} center>
                      <Icon icon={TableInsertColumnAfter} size={20} />
                      Insert column after
                    </HStack>
                  </MenuItem>
                  <MenuItem
                    id="deleteColumn"
                    //onClick={() => exec().deleteColumn().run()}
                  >
                    <HStack gap={8} center>
                      <Icon icon={TableDeleteColumn} size={20} />
                      Delete column
                    </HStack>
                  </MenuItem>
                  <HrDivider />
                  <MenuItem
                    id="deleteTable"
                    // onClick={() => exec().deleteTable().run()}
                  >
                    <HStack gap={8} center>
                      <Icon icon={TableDelete} size={20} />
                      Delete table
                    </HStack>
                  </MenuItem>
                </>
              ) : (
                <MenuItem
                  id="insertTable"
                  /*onClick={() =>
                      exec()
                        .insertTable({rows: 3, cols: 3, withHeaderRow: true})
                        .run()
                    }*/
                >
                  <HStack gap={8} center>
                    <Icon icon={TableInsert} size={20} />
                    Insert table
                  </HStack>
                </MenuItem>
              )}
            </Menu>
          )}
          <div className={styles.root.separator()} />
          <IconButton
            icon={IcRoundFormatBold}
            size={18}
            title="Bold"
            onClick={e => {
              e.preventDefault()
              exec().toggleBold().run()
            }}
            active={editor.isActive('bold')}
          />
          <IconButton
            icon={IcRoundFormatItalic}
            size={18}
            title="Italic"
            onClick={e => {
              e.preventDefault()
              exec().toggleItalic().run()
            }}
            active={editor.isActive('italic')}
          />
          <IconButton
            icon={IcRoundTextFields}
            size={18}
            title="Small"
            onClick={e => {
              e.preventDefault()
              exec().toggleSmall().run()
            }}
            active={editor.isActive('small')}
          />
          <Menu
            label={
              <HStack gap={10} center className={styles.root.dropdown()}>
                <Icon
                  icon={
                    editor.isActive({textAlign: 'center'})
                      ? IcAlignCenter
                      : editor.isActive({textAlign: 'right'})
                      ? IcAlignRight
                      : editor.isActive({textAlign: 'justify'})
                      ? IcAlignJustify
                      : IcAlignLeft
                  }
                  size={18}
                />
                <Icon icon={IcRoundUnfoldMore} />
              </HStack>
            }
            onAction={id => {
              exec()
                .setTextAlign(id as string)
                .run()
            }}
          >
            <MenuItem id="left">
              <HStack gap={8} center>
                <Icon
                  round
                  icon={IcAlignLeft}
                  title="Align left"
                  active={editor.isActive({textAlign: 'left'})}
                />
                <span>Left</span>
              </HStack>
            </MenuItem>
            <MenuItem id="center">
              <HStack gap={8} center>
                <Icon
                  round
                  icon={IcAlignCenter}
                  title="Align center"
                  active={editor.isActive({textAlign: 'center'})}
                />
                <span>Center</span>
              </HStack>
            </MenuItem>
            <MenuItem id="right">
              <HStack gap={8} center>
                <Icon
                  round
                  icon={IcAlignRight}
                  title="Align right"
                  active={editor.isActive({textAlign: 'right'})}
                />
                <span>Right</span>
              </HStack>
            </MenuItem>
            <MenuItem id="justify">
              <HStack gap={8} center>
                <Icon
                  round
                  icon={IcAlignJustify}
                  title="Align justify"
                  active={editor.isActive({textAlign: 'justify'})}
                />
                <span>Justify</span>
              </HStack>
            </MenuItem>
          </Menu>
          <IconButton
            icon={IcRoundFormatClear}
            size={18}
            title="Clear format"
            onClick={e => {
              e.preventDefault()
              exec().unsetAllMarks().run()
              exec().unsetTextAlign().run()
            }}
          />
          <div className={styles.root.separator()} />
          <IconButton
            icon={IcRoundFormatListBulleted}
            size={18}
            title="Bullet list"
            onClick={e => {
              e.preventDefault()
              exec().toggleBulletList().run()
            }}
            active={editor.isActive('bulletList')}
          />
          <IconButton
            icon={IcRoundFormatListNumbered}
            size={18}
            title="Ordered list"
            onClick={e => {
              e.preventDefault()
              exec().toggleOrderedList().run()
            }}
            active={editor.isActive('orderedList')}
          />
          <div className={styles.root.separator()} />
          <IconButton
            icon={IcRoundLink}
            size={18}
            title="Link"
            onClick={handleLink}
            active={editor.isActive('link')}
          />
          <div className={styles.root.separator()} />
          <IconButton
            icon={IcRoundQuote}
            size={18}
            title="Blockquote"
            onClick={e => {
              e.preventDefault()
              exec().toggleBlockquote().run()
            }}
            active={editor.isActive('blockquote')}
          />
          <IconButton
            icon={IcRoundHorizontalRule}
            size={18}
            title="Horizontal Rule"
            onClick={e => {
              e.preventDefault()
              exec().setHorizontalRule().run()
            }}
          />
          <div className={styles.root.separator()} />
          <IconButton
            icon={IcRoundTextFields}
            size={18}
            title="Small"
            onClick={e => {
              e.preventDefault()
              exec().toggleSmall().run()
            }}
            active={editor.isActive('small')}
          />
          <IconButton
            icon={IcRoundSubscript}
            size={18}
            title="Subscript"
            onClick={e => {
              e.preventDefault()
              exec().toggleSubscript().run()
            }}
            active={editor.isActive('subscript')}
          />
          <IconButton
            icon={IcRoundSuperscript}
            size={18}
            title="Superscript"
            onClick={e => {
              e.preventDefault()
              exec().toggleSuperscript().run()
            }}
            active={editor.isActive('superscript')}
          />
        </HStack>
      </div>
    </FieldToolbar.Slot>
  )
})
