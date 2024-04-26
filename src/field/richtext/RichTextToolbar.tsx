import {Reference} from 'alinea/core/Reference'
import {UrlReference} from 'alinea/picker/url'
import {fromModule, HStack, Icon, px, Typo} from 'alinea/ui'
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
import {IcRoundTextFields} from 'alinea/ui/icons/IcRoundTextFields'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
/*import {IcRoundRedo} from 'alinea/ui/icons/IcRoundRedo'
import {IcRoundUndo} from 'alinea/ui/icons/IcRoundUndo'*/
import {Editor} from '@tiptap/react'
import {FieldToolbar} from 'alinea/dashboard/view/entry/FieldToolbar'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import {IcRoundSubscript} from 'alinea/ui/icons/IcRoundSubscript'
import {IcRoundSuperscript} from 'alinea/ui/icons/IcRoundSuperscript'
import {forwardRef, Ref} from 'react'
import {PickTextLinkFunc} from './PickTextLink.js'
import {attributesToReference, referenceToAttributes} from './ReferenceLink.js'
import css from './RichTextToolbar.module.scss'

const styles = fromModule(css)

enum Styles {
  paragraph = 'Normal text',
  h1 = 'Heading 1',
  h2 = 'Heading 2',
  h3 = 'Heading 3',
  h4 = 'Heading 4',
  h5 = 'Heading 5'
}

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
              <DropdownMenu.Item
                onClick={() => exec().setHeading({level: 1}).run()}
              >
                <Typo.H1 flat>Heading 1</Typo.H1>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() => exec().setHeading({level: 2}).run()}
              >
                <Typo.H2 flat>Heading 2</Typo.H2>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() => exec().setHeading({level: 3}).run()}
              >
                <Typo.H3 flat>Heading 3</Typo.H3>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() => exec().setHeading({level: 4}).run()}
              >
                <Typo.H4 flat>Heading 4</Typo.H4>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() => exec().setHeading({level: 5}).run()}
              >
                <Typo.H5 flat>Heading 5</Typo.H5>
              </DropdownMenu.Item>
            </DropdownMenu.Items>
          </DropdownMenu.Root>
          {enableTables && (
            <DropdownMenu.Root top>
              <DropdownMenu.Trigger
                title="Table"
                className={styles.root.dropdown()}
              >
                <HStack gap={10} center>
                  <span>Table</span>
                  <Icon icon={IcRoundUnfoldMore} />
                </HStack>
              </DropdownMenu.Trigger>
              <DropdownMenu.Items>
                {selectedTable ? (
                  <>
                    <DropdownMenu.Item
                      onClick={() => exec().addColumnBefore().run()}
                    >
                      <Typo.P>Insert column before</Typo.P>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onClick={() => exec().addColumnAfter().run()}
                    >
                      <Typo.P>Insert column after</Typo.P>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onClick={() => exec().deleteColumn().run()}
                    >
                      <Typo.P>Delete column</Typo.P>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onClick={() => exec().addRowBefore().run()}
                    >
                      <Typo.P>Insert row before</Typo.P>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onClick={() => exec().addRowAfter().run()}
                    >
                      <Typo.P>Insert row after</Typo.P>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onClick={() => exec().deleteRow().run()}>
                      <Typo.P>Delete row</Typo.P>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onClick={() => exec().deleteTable().run()}
                    >
                      <Typo.P>Delete table</Typo.P>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onClick={() => exec().toggleHeaderRow().run()}
                    >
                      <Typo.P>Toggle header row</Typo.P>
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
                    <Typo.P>Insert table</Typo.P>
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Items>
            </DropdownMenu.Root>
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
              <DropdownMenu.Item
                onClick={() => exec().setTextAlign('left').run()}
              >
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
              <DropdownMenu.Item
                onClick={() => exec().setTextAlign('center').run()}
              >
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
              <DropdownMenu.Item
                onClick={() => exec().setTextAlign('right').run()}
              >
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
              <DropdownMenu.Item
                onClick={() => exec().setTextAlign('justify').run()}
              >
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
            </DropdownMenu.Items>
          </DropdownMenu.Root>
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
