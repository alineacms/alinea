import {Reference} from '@alinea/core/Reference'
import {Toolbar} from '@alinea/dashboard'
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
import {IcRoundQuote} from '@alinea/ui/icons/IcRoundQuote'
import {IcRoundUnfoldMore} from '@alinea/ui/icons/IcRoundUnfoldMore'
/*import {IcRoundRedo} from '@alinea/ui/icons/IcRoundRedo'
import {IcRoundUndo} from '@alinea/ui/icons/IcRoundUndo'*/
import {Editor} from '@tiptap/react'
import {forwardRef, Ref} from 'react'
import {PickTextLinkFunc} from './PickTextLink'
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
  pickLink: PickTextLinkFunc
}

export const RichTextToolbar = forwardRef(function RichTextToolbar(
  {pickLink, editor, focusToggle}: RichTextToolbarProps,
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
    : 'paragraph'
  function parseLink(href: string): Reference | undefined {
    try {
      const url = new URL(href)
      if (url.protocol === 'entry:') {
        const entry = url.pathname
        return {id: entry, type: 'entry', entry}
      }
      return {id: href, type: 'url', url: href}
    } catch (e) {
      return undefined
    }
  }
  function handleLink() {
    const attrs = editor.getAttributes('link')
    const existing: Reference | undefined = attrs?.href && parseLink(attrs.href)
    pickLink({link: existing ? [existing] : undefined}).then(picked => {
      if (!picked) return
      const link = picked.link && picked.link[0]
      if (link?.type === 'entry') {
        const command = exec()
        const action = existing
          ? command.extendMarkRange('link').setLink({
              href: `entry:${link.entry}`,
              target: picked.blank ? '_blank' : undefined
            })
          : command.insertContent({
              type: 'text',
              text: picked.description,
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: `entry:${link.entry}`,
                    target: picked.blank ? '_blank' : undefined
                  }
                }
              ]
            })
        action.run()
      } else {
        exec().extendMarkRange('link').unsetLink().run()
      }
    })
  }
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
            </DropdownMenu.Items>
          </DropdownMenu.Root>
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
        </HStack>
      </div>
    </Toolbar.Slot>
  )
})
