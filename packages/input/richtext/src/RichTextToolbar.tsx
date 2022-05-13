import {ReferencePickerFunc, Toolbar} from '@alinea/dashboard'
import {
  DropdownMenu,
  fromModule,
  HStack,
  Icon,
  IconButton,
  px,
  Typo
} from '@alinea/ui'
import IcAlignCenter from '@alinea/ui/icons/IcAlignCenter'
import IcAlignJustify from '@alinea/ui/icons/IcAlignJustify'
import {IcAlignLeft} from '@alinea/ui/icons/IcAlignLeft'
import IcAlignRight from '@alinea/ui/icons/IcAlignRight'
import {IcRoundFormatBold} from '@alinea/ui/icons/IcRoundFormatBold'
import {IcRoundFormatClear} from '@alinea/ui/icons/IcRoundFormatClear'
import {IcRoundFormatItalic} from '@alinea/ui/icons/IcRoundFormatItalic'
import {IcRoundFormatListBulleted} from '@alinea/ui/icons/IcRoundFormatListBulleted'
import {IcRoundFormatListNumbered} from '@alinea/ui/icons/IcRoundFormatListNumbered'
import {IcRoundLink} from '@alinea/ui/icons/IcRoundLink'
import {IcRoundUnfoldMore} from '@alinea/ui/icons/IcRoundUnfoldMore'
/*import {IcRoundRedo} from '@alinea/ui/icons/IcRoundRedo'
import {IcRoundUndo} from '@alinea/ui/icons/IcRoundUndo'*/
import {Editor} from '@tiptap/react'
import {forwardRef, Ref} from 'react'
import css from './RichTextToolbar.module.scss'

const styles = fromModule(css)

enum Styles {
  paragraph = 'Normal text',
  h1 = 'Heading 1',
  h2 = 'Heading 2',
  h3 = 'Heading 3'
}

export type RichTextToolbarProps = {
  editor: Editor
  focusToggle: (target: EventTarget | null) => void
  pickLink: ReferencePickerFunc
}

export const RichTextToolbar = forwardRef(function RichTextToolbar(
  {pickLink, editor, focusToggle}: RichTextToolbarProps,
  ref: Ref<HTMLDivElement>
) {
  const selectedStyle = editor.isActive('heading', {level: 1})
    ? 'h1'
    : editor.isActive('heading', {level: 2})
    ? 'h2'
    : editor.isActive('heading', {level: 3})
    ? 'h3'
    : 'paragraph'

  return (
    <Toolbar.Slot>
      <div
        ref={ref}
        tabIndex={-1}
        className={styles.root()}
        onFocus={e => focusToggle(e.currentTarget)}
        onBlur={e => focusToggle(e.relatedTarget)}
      >
        <HStack gap={10} center style={{height: '100%', padding: `${px(4)} 0`}}>
          <DropdownMenu.Root>
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
              <DropdownMenu.Item
                onClick={() => editor.chain().focus().clearNodes().run()}
              >
                <Typo.P>Normal text</Typo.P>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() =>
                  editor.chain().focus().setHeading({level: 1}).run()
                }
              >
                <Typo.H1 flat>Heading 1</Typo.H1>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() =>
                  editor.chain().focus().setHeading({level: 2}).run()
                }
              >
                <Typo.H2 flat>Heading 2</Typo.H2>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() =>
                  editor.chain().focus().setHeading({level: 3}).run()
                }
              >
                <Typo.H3 flat>Heading 3</Typo.H3>
              </DropdownMenu.Item>
            </DropdownMenu.Items>
          </DropdownMenu.Root>
          <div className={styles.root.separator()} />
          <IconButton
            icon={IcRoundFormatBold}
            size={18}
            title="Bold"
            onClick={e => {
              e.preventDefault()
              editor.chain().focus().toggleBold().run()
            }}
            active={editor.isActive('bold')}
          />
          <IconButton
            icon={IcRoundFormatItalic}
            size={18}
            title="Italic"
            onClick={e => {
              e.preventDefault()
              editor.chain().focus().toggleItalic().run()
            }}
            active={editor.isActive('italic')}
          />
          <DropdownMenu.Root>
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
                onClick={() =>
                  editor.chain().focus().setTextAlign('left').run()
                }
              >
                <Icon
                  icon={IcAlignLeft}
                  size={18}
                  title="Align left"
                  active={editor.isActive({textAlign: 'left'})}
                />
                Left
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() =>
                  editor.chain().focus().setTextAlign('center').run()
                }
              >
                <Icon
                  icon={IcAlignCenter}
                  size={18}
                  title="Align center"
                  active={editor.isActive({textAlign: 'center'})}
                />
                Center
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() =>
                  editor.chain().focus().setTextAlign('right').run()
                }
              >
                <Icon
                  icon={IcAlignRight}
                  size={18}
                  title="Align right"
                  active={editor.isActive({textAlign: 'right'})}
                />
                Right
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() =>
                  editor.chain().focus().setTextAlign('justify').run()
                }
              >
                <Icon
                  icon={IcAlignJustify}
                  size={18}
                  title="Align justify"
                  active={editor.isActive({textAlign: 'justify'})}
                />
                Justify
              </DropdownMenu.Item>
            </DropdownMenu.Items>
          </DropdownMenu.Root>
          <IconButton
            icon={IcRoundFormatClear}
            size={18}
            title="Clear format"
            onClick={e => {
              e.preventDefault()
              editor.chain().focus().unsetAllMarks().run()
              editor.chain().focus().unsetTextAlign().run()
            }}
          />
          <div className={styles.root.separator()} />
          <IconButton
            icon={IcRoundFormatListBulleted}
            size={18}
            title="Bullet list"
            onClick={e => {
              e.preventDefault()
              editor.chain().focus().toggleBulletList().run()
            }}
            active={editor.isActive('bulletList')}
          />
          <IconButton
            icon={IcRoundFormatListNumbered}
            size={18}
            title="Ordered list"
            onClick={e => {
              e.preventDefault()
              editor.chain().focus().toggleOrderedList().run()
            }}
            active={editor.isActive('orderedList')}
          />
          <div className={styles.root.separator()} />
          <IconButton
            icon={IcRoundLink}
            size={18}
            title="Link"
            onClick={e => {
              e.preventDefault()
              pickLink({
                selection: [],
                max: 1
              }).then(links => {
                if (links && links[0] && links[0].type === 'entry') {
                  editor
                    .chain()
                    .focus()
                    .extendMarkRange('link')
                    .setLink({href: 'entry:' + links[0].id})
                    .run()
                } else {
                  editor
                    .chain()
                    .focus()
                    .extendMarkRange('link')
                    .unsetLink()
                    .run()
                }
              })
            }}
            active={editor.isActive('link')}
          />
        </HStack>
      </div>
    </Toolbar.Slot>
  )
})
