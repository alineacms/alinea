/*import {IcRoundRedo} from 'alinea/ui/icons/IcRoundRedo'
import {IcRoundUndo} from 'alinea/ui/icons/IcRoundUndo'*/
import styler from '@alinea/styler'
import type {Editor} from '@tiptap/react'
import type {Reference} from 'alinea/core/Reference'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import type {UrlReference} from 'alinea/picker/url'
import {HStack, Icon, px, Typo} from 'alinea/ui'
import {DropdownMenu} from 'alinea/ui/DropdownMenu'
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
import {forwardRef, type ReactNode, type Ref} from 'react'
import type {PickTextLinkFunc} from './PickTextLink.js'
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

export type RichTextCommand = () => ReturnType<Editor['chain']>

export type RichTextToolbarProps = {
  editor: Editor
  focusToggle: (target: EventTarget | null) => void
  pickLink: PickTextLinkFunc
  enableTables?: boolean
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
}

export const RichTextMenuDivider = HrDivider

export type RichTextToolbarRootProps = {
  focusToggle: (target: EventTarget | null) => void
  children: ReactNode
}

export const RichTextToolbarRoot = forwardRef(function RichTextToolbarRoot(
  {focusToggle, children}: RichTextToolbarRootProps,
  ref: Ref<HTMLDivElement>
) {
  return (
    <div
      ref={ref}
      tabIndex={-1}
      className={styles.root()}
      onFocus={e => focusToggle(e.currentTarget)}
      onBlur={e => focusToggle(e.relatedTarget)}
    >
      {children}
    </div>
  )
})

export function RichTextToolbarSeparator() {
  return <div className={styles.root.separator()} />
}

export type RichTextHeadingMenuProps = {
  editor: Editor
  exec?: RichTextCommand
  children?: ReactNode
}

export function RichTextHeadingMenu({
  editor,
  exec = createToolbarExec(editor),
  children
}: RichTextHeadingMenuProps) {
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
  return (
    <DropdownMenu.Root top>
      <DropdownMenu.Trigger
        title="Heading/paragraph"
        className={styles.root.dropdown()}
      >
        <HStack gap={10} center>
          <span>{Styles[selectedStyle]}</span>
          <Icon icon={IcRoundUnfoldMore} />
        </HStack>
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        <DropdownMenu.Item onClick={() => exec().clearNodes().run()}>
          <Typo.P>Normal text</Typo.P>
        </DropdownMenu.Item>
        <DropdownMenu.Item onClick={() => exec().setHeading({level: 1}).run()}>
          <Typo.H1 flat>Heading 1</Typo.H1>
        </DropdownMenu.Item>
        <DropdownMenu.Item onClick={() => exec().setHeading({level: 2}).run()}>
          <Typo.H2 flat>Heading 2</Typo.H2>
        </DropdownMenu.Item>
        <DropdownMenu.Item onClick={() => exec().setHeading({level: 3}).run()}>
          <Typo.H3 flat>Heading 3</Typo.H3>
        </DropdownMenu.Item>
        <DropdownMenu.Item onClick={() => exec().setHeading({level: 4}).run()}>
          <Typo.H4 flat>Heading 4</Typo.H4>
        </DropdownMenu.Item>
        <DropdownMenu.Item onClick={() => exec().setHeading({level: 5}).run()}>
          <Typo.H5 flat>Heading 5</Typo.H5>
        </DropdownMenu.Item>
        {children}
      </DropdownMenu.Items>
    </DropdownMenu.Root>
  )
}

export type RichTextTableMenuProps = {
  editor: Editor
  exec?: RichTextCommand
  children?: ReactNode
}

export function RichTextTableMenu({
  editor,
  exec = createToolbarExec(editor),
  children
}: RichTextTableMenuProps) {
  const selectedTable = editor.isActive('table')
  return (
    <DropdownMenu.Root top>
      <DropdownMenu.Trigger title="Table" className={styles.root.dropdown()}>
        <HStack gap={10} center>
          <span>Table</span>
          <Icon icon={IcRoundUnfoldMore} />
        </HStack>
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        {selectedTable ? (
          <>
            <DropdownMenu.Item
              onClick={() => exec().mergeCells().run()}
              disabled={!editor.can().mergeCells()}
            >
              <HStack gap={8} center>
                <Icon icon={TableMergeCells} size={20} />
                Merge cells
              </HStack>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onClick={() => exec().splitCell().run()}
              disabled={!editor.can().splitCell()}
            >
              <HStack gap={8} center>
                <Icon icon={TableSplitCell} size={20} />
                Split cell
              </HStack>
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => exec().toggleHeaderCell().run()}>
              <HStack gap={8} center>
                <Icon icon={TableHeaderCell} size={20} />
                Toggle header cell
              </HStack>
            </DropdownMenu.Item>
            <HrDivider />
            <DropdownMenu.Item onClick={() => exec().addColumnBefore().run()}>
              <HStack gap={8} center>
                <Icon icon={TableInsertColumnBefore} size={20} />
                Insert column before
              </HStack>
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => exec().addColumnAfter().run()}>
              <HStack gap={8} center>
                <Icon icon={TableInsertColumnAfter} size={20} />
                Insert column after
              </HStack>
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => exec().toggleHeaderColumn().run()}>
              <HStack gap={8} center>
                <Icon icon={TableHeaderColumn} size={20} />
                Toggle header column
              </HStack>
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => exec().deleteColumn().run()}>
              <HStack gap={8} center>
                <Icon icon={TableDeleteColumn} size={20} />
                Delete column
              </HStack>
            </DropdownMenu.Item>
            <HrDivider />
            <DropdownMenu.Item onClick={() => exec().addRowBefore().run()}>
              <HStack gap={8} center>
                <Icon icon={TableInsertRowBefore} size={20} />
                Insert row before
              </HStack>
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => exec().addRowAfter().run()}>
              <HStack gap={8} center>
                <Icon icon={TableInsertRowAfter} size={20} />
                Insert row after
              </HStack>
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => exec().toggleHeaderRow().run()}>
              <HStack gap={8} center>
                <Icon icon={TableHeaderRow} size={20} />
                Toggle header row
              </HStack>
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => exec().deleteRow().run()}>
              <HStack gap={8} center>
                <Icon icon={TableDeleteRow} size={20} />
                Delete row
              </HStack>
            </DropdownMenu.Item>
            <HrDivider />
            <DropdownMenu.Item onClick={() => exec().deleteTable().run()}>
              <HStack gap={8} center>
                <Icon icon={TableDelete} size={20} />
                Delete table
              </HStack>
            </DropdownMenu.Item>
          </>
        ) : (
          <DropdownMenu.Item
            onClick={() =>
              exec()
                .insertTable({rows: 3, cols: 3, withHeaderRow: true})
                .run()
            }
          >
            <HStack gap={8} center>
              <Icon icon={TableInsert} size={20} />
              Insert table
            </HStack>
          </DropdownMenu.Item>
        )}
        {children}
      </DropdownMenu.Items>
    </DropdownMenu.Root>
  )
}

export type RichTextAlignmentMenuProps = {
  editor: Editor
  exec?: RichTextCommand
  children?: ReactNode
}

export function RichTextAlignmentMenu({
  editor,
  exec = createToolbarExec(editor),
  children
}: RichTextAlignmentMenuProps) {
  return (
    <DropdownMenu.Root top>
      <DropdownMenu.Trigger
        title="Alignment"
        className={styles.root.dropdown()}
      >
        <HStack gap={10} center>
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
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        <DropdownMenu.Item onClick={() => exec().setTextAlign('left').run()}>
          <HStack gap={8} center>
            <Icon
              round
              icon={IcAlignLeft}
              title="Align left"
              active={editor.isActive({textAlign: 'left'})}
            />
            <span>Left</span>
          </HStack>
        </DropdownMenu.Item>
        <DropdownMenu.Item onClick={() => exec().setTextAlign('center').run()}>
          <HStack gap={8} center>
            <Icon
              round
              icon={IcAlignCenter}
              title="Align center"
              active={editor.isActive({textAlign: 'center'})}
            />
            <span>Center</span>
          </HStack>
        </DropdownMenu.Item>
        <DropdownMenu.Item onClick={() => exec().setTextAlign('right').run()}>
          <HStack gap={8} center>
            <Icon
              round
              icon={IcAlignRight}
              title="Align right"
              active={editor.isActive({textAlign: 'right'})}
            />
            <span>Right</span>
          </HStack>
        </DropdownMenu.Item>
        <DropdownMenu.Item onClick={() => exec().setTextAlign('justify').run()}>
          <HStack gap={8} center>
            <Icon
              round
              icon={IcAlignJustify}
              title="Align justify"
              active={editor.isActive({textAlign: 'justify'})}
            />
            <span>Justify</span>
          </HStack>
        </DropdownMenu.Item>
        {children}
      </DropdownMenu.Items>
    </DropdownMenu.Root>
  )
}

export const RichTextToolbar = forwardRef(function RichTextToolbar(
  {pickLink, editor, focusToggle, enableTables}: RichTextToolbarProps,
  ref: Ref<HTMLDivElement>
) {
  const exec = createToolbarExec(editor)
  const handleLink = createLinkHandler(editor, pickLink, exec)
  return (
    <RichTextToolbarRoot ref={ref} focusToggle={focusToggle}>
      <HStack gap={10} center style={{height: '100%', padding: `${px(4)} 0`}}>
        <RichTextHeadingMenu editor={editor} exec={exec} />
        {enableTables && (
          <RichTextTableMenu editor={editor} exec={exec} />
        )}
        <RichTextToolbarSeparator />
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
        <RichTextAlignmentMenu editor={editor} exec={exec} />
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
        <RichTextToolbarSeparator />
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
        <RichTextToolbarSeparator />
        <IconButton
          icon={IcRoundLink}
          size={18}
          title="Link"
          onClick={handleLink}
          active={editor.isActive('link')}
        />
        <RichTextToolbarSeparator />
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
        <RichTextToolbarSeparator />
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
    </RichTextToolbarRoot>
  )
})
