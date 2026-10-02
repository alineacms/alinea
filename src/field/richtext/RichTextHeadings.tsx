import {
  Badge,
  Button,
  Kbd,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetSection,
  SheetTitle
} from '#/components.js'
import {BlockSheet, useBlockSheet} from '#/dashboard/app/BlockSheet.js'
import {useEntry} from '#/dashboard/hooks.js'
import {IcRoundLink, IcRoundMoreHoriz} from '#/dashboard/icons.js'
import {SlugField} from '#/field/path/SlugField.js'
import styler from '@alinea/styler'
import {type Editor, Extension} from '@tiptap/core'
import {Plugin, PluginKey} from '@tiptap/pm/state'
import {Decoration, DecorationSet} from '@tiptap/pm/view'
import {useEditorState} from '@tiptap/react'
import {
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import css from './RichTextHeadings.module.css'

const styles = styler(css)

interface OpenHeading {
  pos: number
  level: number
  text: string
  anchor?: string
}

const openKey = new PluginKey<number | undefined>('richTextHeadingSheet')

// Headings have no id of their own: their anchor follows the text and is
// edited in the sheet. The open heading is tracked by its position instead,
// mapped through every edit, so nothing extra ends up in the document.
export const richTextHeadingSheet = Extension.create({
  name: 'richTextHeadingSheet',
  addProseMirrorPlugins() {
    return [
      new Plugin<number | undefined>({
        key: openKey,
        state: {
          init: () => undefined,
          apply(tr, current) {
            const meta: {pos?: number} | undefined = tr.getMeta(openKey)
            if (meta) return meta.pos
            if (current === undefined) return
            // Map the start of its content, the position before the heading
            // also counts as deleted when only its attributes change
            const inside = tr.mapping.mapResult(current + 1, -1)
            const pos = inside.pos - 1
            if (inside.deletedAcross || pos < 0) return
            return tr.doc.nodeAt(pos)?.type.name === 'heading' ? pos : undefined
          }
        },
        props: {
          decorations(state) {
            const pos = openKey.getState(state)
            const node = pos === undefined ? null : state.doc.nodeAt(pos)
            if (pos === undefined || !node) return null
            return DecorationSet.create(state.doc, [
              Decoration.node(pos, pos + node.nodeSize, {
                class: styles.RichTextHeadings.current()
              })
            ])
          }
        }
      })
    ]
  }
})

export interface RichTextHeadingsProps {
  editor: Editor
  root: RefObject<HTMLDivElement | null>
  readOnly: boolean
}

/** The settings button of hovered headings and the sheet it opens */
export function RichTextHeadings({
  editor,
  root,
  readOnly
}: RichTextHeadingsProps) {
  const id = useId()
  const sheet = useBlockSheet(`heading${id}`)
  const open = useEditorState({
    editor,
    selector: ({editor}) => openHeading(editor)
  })
  const [hovered, setHovered] = useState<HTMLElement>()
  const layer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = root.current
    if (!element) return
    function track(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-richtext-heading-button]')) return
      setHovered(headingElement(editor, target))
    }
    function leave() {
      setHovered(undefined)
    }
    element.addEventListener('mouseover', track)
    element.addEventListener('mouseleave', leave)
    return () => {
      element.removeEventListener('mouseover', track)
      element.removeEventListener('mouseleave', leave)
    }
  }, [editor, root])

  // Either side can close on its own: another sheet opens, or the heading
  // is removed or turned into a paragraph
  useEffect(() => {
    if (sheet.open && !open) sheet.setOpen(false)
    else if (!sheet.open && open) select(editor, undefined)
  }, [editor, open, sheet])

  const current = sheet.open && open ? editor.view.nodeDOM(open.pos) : null
  const active = current instanceof HTMLElement ? current : undefined
  const hover = hovered?.isConnected && hovered !== active ? hovered : undefined

  function toggle(heading: HTMLElement) {
    const pos = headingPosition(editor, heading)
    if (pos === undefined) return
    if (sheet.open && open?.pos === pos) return sheet.setOpen(false)
    select(editor, pos)
    sheet.setOpen(true)
  }

  function setAnchor(anchor: string) {
    if (!open) return
    const node = editor.state.doc.nodeAt(open.pos)
    if (node?.type.name !== 'heading') return
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(open.pos, undefined, {
        ...node.attrs,
        _anchor: anchor || null
      })
    )
  }

  return (
    // Buttons are placed from this empty layer: positioning the field itself
    // would move the floating insert menu
    <div ref={layer} className={styles.RichTextHeadings()}>
      {active && (
        <RichTextHeadingButton
          key="active"
          active
          heading={active}
          layer={layer}
          root={root}
          onClick={() => toggle(active)}
        />
      )}
      {hover && (
        <RichTextHeadingButton
          key="hover"
          active={false}
          heading={hover}
          layer={layer}
          root={root}
          onClick={() => toggle(hover)}
        />
      )}
      <BlockSheet id={`heading${id}`}>
        {open && (
          <RichTextHeadingSheet
            heading={open}
            readOnly={readOnly}
            onAnchorChange={setAnchor}
            onClose={() => sheet.setOpen(false)}
          />
        )}
      </BlockSheet>
    </div>
  )
}

interface RichTextHeadingButtonProps {
  active: boolean
  heading: HTMLElement
  layer: RefObject<HTMLDivElement | null>
  root: RefObject<HTMLDivElement | null>
  onClick: () => void
}

function RichTextHeadingButton({
  active,
  heading,
  layer,
  root,
  onClick
}: RichTextHeadingButtonProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState<number>()

  useLayoutEffect(() => {
    const container = root.current
    if (!container) return
    function measure() {
      const origin = layer.current
      const button = ref.current
      if (!origin || !button) return
      const box = heading.getBoundingClientRect()
      const line = Number.parseFloat(getComputedStyle(heading).lineHeight)
      const height = Number.isNaN(line) ? box.height : line
      const offset = box.top - origin.getBoundingClientRect().top
      setTop(offset + (height - button.offsetHeight) / 2)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    observer.observe(heading)
    return () => observer.disconnect()
  }, [heading, layer, root])

  return (
    <div
      ref={ref}
      className={styles.RichTextHeadingButton()}
      data-richtext-heading-button="true"
      style={{top, visibility: top === undefined ? 'hidden' : undefined}}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        icon={IcRoundMoreHoriz}
        aria-label="Heading settings"
        aria-expanded={active}
        active={active}
        onClick={onClick}
      />
    </div>
  )
}

interface RichTextHeadingSheetProps {
  heading: OpenHeading
  readOnly: boolean
  onAnchorChange: (anchor: string) => void
  onClose: () => void
}

function RichTextHeadingSheet({
  heading,
  readOnly,
  onAnchorChange,
  onClose
}: RichTextHeadingSheetProps) {
  const entryUrl = useEntry()?.url
  const link =
    entryUrl && heading.anchor ? `${entryUrl}#${heading.anchor}` : undefined
  return (
    <SheetContent onClose={onClose}>
      <SheetHeader>
        <Badge size="sm">H{heading.level}</Badge>
        <SheetTitle>{heading.text.trim() || 'Heading'}</SheetTitle>
        <Kbd size="sm" aria-hidden>
          Esc
        </Kbd>
        <SheetClose aria-label="Close heading settings" />
      </SheetHeader>
      <SheetBody>
        <SheetSection title="General">
          <div className={styles.RichTextHeadingSheet.anchor()}>
            <div className={styles.RichTextHeadingSheet.anchor.field()}>
              <SlugField
                fieldValue={heading.anchor ?? ''}
                label="Anchor"
                isReadOnly={readOnly}
                onChange={onAnchorChange}
              />
            </div>
            {link && (
              <Button
                variant="ghost"
                size="icon"
                icon={IcRoundLink}
                aria-label="Copy link to heading"
                onClick={() => navigator.clipboard.writeText(link)}
              />
            )}
          </div>
        </SheetSection>
      </SheetBody>
    </SheetContent>
  )
}

function openHeading(editor: Editor): OpenHeading | undefined {
  if (editor.isDestroyed) return
  const pos = openKey.getState(editor.state)
  if (pos === undefined) return
  const node = editor.state.doc.nodeAt(pos)
  if (!node) return
  const anchor = node.attrs._anchor
  return {
    pos,
    level: Number(node.attrs.level),
    text: node.textContent,
    anchor: typeof anchor === 'string' ? anchor : undefined
  }
}

function select(editor: Editor, pos: number | undefined) {
  if (editor.isDestroyed) return
  editor.view.dispatch(
    editor.state.tr.setMeta(openKey, {pos}).setMeta('addToHistory', false)
  )
}

function headingElement(
  editor: Editor,
  target: Element
): HTMLElement | undefined {
  const heading = target.closest<HTMLElement>('h1, h2, h3, h4, h5, h6')
  // Nested rich text fields inside blocks handle their own headings
  if (heading?.closest('.ProseMirror') !== editor.view.dom) return
  return heading
}

function headingPosition(
  editor: Editor,
  heading: HTMLElement
): number | undefined {
  const pos = editor.view.posAtDOM(heading, 0) - 1
  if (pos < 0) return
  return editor.state.doc.nodeAt(pos)?.type.name === 'heading' ? pos : undefined
}
