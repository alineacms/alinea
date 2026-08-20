import styler from '@alinea/styler'
import {
  type CSSProperties,
  type MouseEvent,
  type PropsWithChildren,
  type ReactNode,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useRef,
  useState
} from 'react'
import {flushSync} from 'react-dom'
import {createRoot} from 'react-dom/client'
import {Badge} from './Badge.js'
import {Button} from './Button.js'
import {Checkbox} from './Checkbox.js'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHeading,
  DialogOverlay,
  DialogTitle
} from './Dialog.js'
import {Field} from './Field.js'
import {
  PreviewCaption,
  PreviewGrid,
  PreviewIcon,
  PreviewRow,
  PreviewStack
} from './Preview.js'
import {
  Surface,
  SurfaceContent,
  SurfaceFooter,
  SurfaceHeader,
  SurfaceTitle
} from './Surface.js'
import {
  ColorTokens,
  DesignTokens,
  RadiusTokens,
  SpacingTokens,
  TypographyTokens
} from './Tokens.js'
import {ThemeSwitch} from './ThemeSwitch.js'
import {Tabs} from './Tabs.js'
import viewport from './viewport.module.css'

const styles = styler(viewport)
const pageGutter = 512
const pageMargin = 32
const defaultContentWidth = 720

function pageWhitespace(zoom: number, focusWhitespace = 0) {
  return Math.max(focusWhitespace, (zoom - 1) * pageGutter, 0)
}

interface ViewportProps extends PropsWithChildren {
  label?: ReactNode
  width?: number
}

interface DesignSurfaceProps extends PropsWithChildren {}

interface StoryRowProps extends PropsWithChildren {
  title: string
}

interface PanState {
  pointerId: number
  x: number
  y: number
}

function Viewport({label, width, children}: ViewportProps) {
  const uniqueId = useId().replace(/:/g, '')

  return (
    <div className={viewport.viewport}>
      {label && <div className={viewport.label}>{label}</div>}
      <div className={viewport.canvas}>
        <div
          className={viewport.frame}
          data-content-width={width ?? defaultContentWidth}
          data-design-frame
          style={
            {
              '--alinea-viewport-transition-name': `viewport-${uniqueId}`
            } as CSSProperties
          }
          tabIndex={-1}
        >
          <div
            className={viewport.inner}
            style={
              {
                '--alinea-content-width': `${width ?? defaultContentWidth}px`
              } as CSSProperties
            }
          >
            <div className={viewport.layout}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StoryRow({children, title}: StoryRowProps) {
  return (
    <section className={viewport.storyRow}>
      <h2 className={viewport.storyRowTitle}>{title}</h2>
      <div className={viewport.storyRowItems}>{children}</div>
    </section>
  )
}

function ButtonStory() {
  return (
    <PreviewStack gap="large">
      <PreviewStack>
        <PreviewCaption>Intent and appearance</PreviewCaption>
        <PreviewRow>
          <Button>Neutral</Button>
          <Button intent="primary">Primary</Button>
          <Button intent="secondary">Secondary</Button>
          <Button intent="danger">Delete</Button>
          <Button appearance="outline" intent="primary">
            Outline
          </Button>
          <Button appearance="plain">Plain</Button>
        </PreviewRow>
      </PreviewStack>
      <PreviewStack>
        <PreviewCaption>Size and state</PreviewCaption>
        <PreviewRow>
          <Button size="small">Small</Button>
          <Button>Medium</Button>
          <Button size="large">Large</Button>
          <Button aria-label="Add" size="icon">
            <PreviewIcon>+</PreviewIcon>
          </Button>
          <Button data-hovered>Hover</Button>
          <Button data-focus-visible>Focus</Button>
          <Button disabled>Disabled</Button>
        </PreviewRow>
      </PreviewStack>
    </PreviewStack>
  )
}

function FieldStory() {
  return (
    <PreviewStack gap="large">
      <Field
        description="Used in navigation and search results."
        label="Title"
        placeholder="Untitled page"
      />
      <Field
        label="Summary"
        multiline
        optional
        placeholder="Write a short summary…"
        rows={4}
      />
      <Field
        defaultValue="news/launch"
        error="Paths must start with a slash."
        label="Path"
      />
      <Field disabled defaultValue="page_01J123" label="Generated id" />
    </PreviewStack>
  )
}

function CheckboxStory() {
  return (
    <PreviewStack>
      <Checkbox label="Include in navigation" />
      <Checkbox
        defaultSelected
        description="Visitors can find this page from the main menu."
        label="Published in navigation"
      />
      <Checkbox indeterminate label="Some child entries selected" />
      <Checkbox defaultSelected invalid label="Selection needs attention" />
      <Checkbox disabled label="Unavailable option" />
    </PreviewStack>
  )
}

function SurfaceStory() {
  return (
    <Surface>
      <SurfaceHeader>
        <SurfaceTitle>Base surface</SurfaceTitle>
      </SurfaceHeader>
      <SurfaceContent>
        <PreviewCaption>
          Root surfaces use the raised background and shadow.
        </PreviewCaption>
        <Surface>
          <SurfaceHeader>
            <SurfaceTitle>Nested surface</SurfaceTitle>
          </SurfaceHeader>
          <SurfaceContent>
            <PreviewCaption>
              Unqualified nested surfaces become muted through scope.
            </PreviewCaption>
          </SurfaceContent>
        </Surface>
        <Surface depth="base">
          <SurfaceHeader>
            <SurfaceTitle>Explicit base override</SurfaceTitle>
          </SurfaceHeader>
          <SurfaceContent>
            <PreviewCaption>
              A depth attribute can opt out when contrast is required.
            </PreviewCaption>
          </SurfaceContent>
        </Surface>
      </SurfaceContent>
    </Surface>
  )
}

function CompositionStory() {
  return (
    <Surface>
      <SurfaceHeader>
        <SurfaceTitle>Page details</SurfaceTitle>
        <PreviewCaption>
          A small composition made only from the first primitives.
        </PreviewCaption>
      </SurfaceHeader>
      <SurfaceContent>
        <PreviewGrid columns={2}>
          <Field defaultValue="About us" label="Title" />
          <Field defaultValue="/about" label="Path" />
        </PreviewGrid>
        <Field
          label="Summary"
          multiline
          placeholder="Tell visitors what this page is about…"
          rows={5}
        />
      </SurfaceContent>
      <SurfaceFooter>
        <Button appearance="plain">Cancel</Button>
        <Button intent="primary">Save changes</Button>
      </SurfaceFooter>
    </Surface>
  )
}

function BadgeStory() {
  return (
    <PreviewStack>
      <PreviewRow>
        <Badge>Default</Badge>
        <Badge status="published">Published</Badge>
        <Badge status="draft">Draft</Badge>
        <Badge status="unpublished">Unpublished</Badge>
        <Badge status="archived">Archived</Badge>
      </PreviewRow>
      <PreviewRow>
        <Badge size="small">Shared</Badge>
        <Badge size="small" status="published">
          Published
        </Badge>
        <Badge size="small" status="draft">
          Draft
        </Badge>
      </PreviewRow>
    </PreviewStack>
  )
}

const tabItems = [
  {
    id: 'content',
    label: 'Content',
    content: <PreviewCaption>Fields and structured content.</PreviewCaption>
  },
  {
    id: 'settings',
    label: 'Settings',
    content: <PreviewCaption>Path, publishing, and metadata.</PreviewCaption>
  },
  {
    id: 'history',
    label: 'History',
    content: <PreviewCaption>Previous versions of this entry.</PreviewCaption>
  }
]

function TabsStory() {
  return (
    <PreviewStack gap="large">
      <Tabs items={tabItems} variant="line" />
      <Tabs items={tabItems} variant="subtle" />
      <Tabs items={tabItems} variant="enclosed" />
    </PreviewStack>
  )
}

function DialogStory() {
  return (
    <DialogOverlay mode="preview">
      <Dialog aria-label="Create entry">
        <DialogHeader>
          <DialogHeading>
            <DialogTitle>Create entry</DialogTitle>
            <DialogDescription>
              Add a page to the selected workspace.
            </DialogDescription>
          </DialogHeading>
          <Button appearance="plain" aria-label="Close" size="icon">
            <PreviewIcon>×</PreviewIcon>
          </Button>
        </DialogHeader>
        <DialogContent>
          <Field label="Title" placeholder="Untitled page" />
          <Field label="Path" placeholder="/untitled-page" />
          <Checkbox defaultSelected label="Open after creating" />
        </DialogContent>
        <DialogFooter>
          <Button appearance="plain">Cancel</Button>
          <Button intent="primary">Create entry</Button>
        </DialogFooter>
      </Dialog>
    </DialogOverlay>
  )
}

function DesignSurface({children}: DesignSurfaceProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<PanState | null>(null)
  const suppressClickRef = useRef(false)
  const spacePressedRef = useRef(false)
  const focusWhitespaceRef = useRef(0)
  const zoomRef = useRef(1)
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [focusWhitespace, setFocusWhitespace] = useState(0)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const surface: HTMLDivElement = stage

    function handleWheel(event: WheelEvent) {
      if (!event.ctrlKey) return
      event.preventDefault()
      const bounds = surface.getBoundingClientRect()
      const pointerX = event.clientX - bounds.left
      const pointerY = event.clientY - bounds.top
      const previousZoom = zoomRef.current
      const nextZoom = Math.min(
        4,
        Math.max(0.25, previousZoom * Math.exp(event.deltaY * -0.002))
      )
      const ratio = nextZoom / previousZoom
      const previousScrollLeft = surface.scrollLeft
      const previousScrollTop = surface.scrollTop
      const previousWhitespace = pageWhitespace(
        previousZoom,
        focusWhitespaceRef.current
      )
      const nextWhitespace = pageWhitespace(nextZoom)

      focusWhitespaceRef.current = 0
      zoomRef.current = nextZoom
      flushSync(() => {
        setFocusWhitespace(0)
        setZoom(nextZoom)
      })
      surface.scrollLeft =
        nextWhitespace +
        (previousScrollLeft + pointerX - previousWhitespace) * ratio -
        pointerX
      surface.scrollTop =
        nextWhitespace +
        (previousScrollTop + pointerY - previousWhitespace) * ratio -
        pointerY
    }

    stage.addEventListener('wheel', handleWheel, {passive: false})
    return () => stage.removeEventListener('wheel', handleWheel)
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.ctrlKey &&
        (event.code === 'Digit0' || event.code === 'Numpad0')
      ) {
        event.preventDefault()
        if (!stageRef.current) return
        focusWhitespaceRef.current = 0
        zoomRef.current = 1
        flushSync(() => {
          setFocusWhitespace(0)
          setZoom(1)
        })
        stageRef.current.scrollLeft = 0
        stageRef.current.scrollTop = 0
        return
      }
      if (event.code !== 'Space') return
      event.preventDefault()
      spacePressedRef.current = true
      setIsSpacePressed(true)
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code !== 'Space') return
      event.preventDefault()
      spacePressedRef.current = false
      setIsSpacePressed(false)
    }

    function handleBlur() {
      panRef.current = null
      spacePressedRef.current = false
      suppressClickRef.current = false
      setIsPanning(false)
      setIsSpacePressed(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!spacePressedRef.current || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    panRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    }
    suppressClickRef.current = true
    setIsPanning(true)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    event.preventDefault()
    const x = event.clientX
    const y = event.clientY
    const deltaX = x - pan.x
    const deltaY = y - pan.y
    pan.x = x
    pan.y = y
    event.currentTarget.scrollLeft -= deltaX
    event.currentTarget.scrollTop -= deltaY
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    panRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    setIsPanning(false)
    window.setTimeout(() => {
      suppressClickRef.current = false
    })
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (panRef.current?.pointerId !== event.pointerId) return
    panRef.current = null
    suppressClickRef.current = false
    setIsPanning(false)
  }

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (!(event.target instanceof Element)) return
    if (
      event.target.closest(
        'button, input, textarea, select, a, [contenteditable="true"]'
      )
    )
      return
    const frame = event.target.closest('[data-design-frame]')
    if (!(frame instanceof HTMLDivElement)) return
    const contentWidth = Number(frame.dataset.contentWidth)
    if (!Number.isFinite(contentWidth)) return

    frame.focus()
    document.startViewTransition(() => {
      const surface = stageRef.current
      if (!surface) return
      const targetZoom = Math.min(
        4,
        Math.max(1, contentWidth / frame.offsetWidth)
      )
      const whitespace = Math.max(
        0,
        surface.clientWidth / 2 - (frame.offsetWidth * targetZoom) / 2,
        surface.clientHeight / 2 - (frame.offsetHeight * targetZoom) / 2
      )

      focusWhitespaceRef.current = whitespace
      zoomRef.current = targetZoom
      flushSync(() => {
        setFocusWhitespace(whitespace)
        setZoom(targetZoom)
      })

      const surfaceBounds = surface.getBoundingClientRect()
      const frameBounds = frame.getBoundingClientRect()
      surface.scrollLeft +=
        frameBounds.left +
        frameBounds.width / 2 -
        surfaceBounds.left -
        surface.clientWidth / 2
      surface.scrollTop +=
        frameBounds.top +
        frameBounds.height / 2 -
        surfaceBounds.top -
        surface.clientHeight / 2
    })
  }

  return (
    <div
      className={styles.stage({
        space: isSpacePressed,
        panning: isPanning
      })}
      ref={stageRef}
      style={
        {
          '--alinea-page-gutter': `${pageGutter}px`,
          '--alinea-page-focus-whitespace': `${focusWhitespace}px`,
          '--alinea-page-margin': `${pageMargin}px`,
          '--alinea-page-zoom': zoom
        } as CSSProperties
      }
      onClickCapture={handleClickCapture}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className={viewport.page}>{children}</div>
    </div>
  )
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  return (
    <DesignTokens theme={theme}>
      <ThemeSwitch onChange={setTheme} theme={theme} />
      <DesignSurface>
        <StoryRow title="Tokens">
          <Viewport label="Color" width={720}>
            <ColorTokens />
          </Viewport>
          <Viewport label="Spacing and radius" width={640}>
            <PreviewStack gap="large">
              <SpacingTokens />
              <RadiusTokens />
            </PreviewStack>
          </Viewport>
          <Viewport label="Typography" width={560}>
            <TypographyTokens />
          </Viewport>
        </StoryRow>

        <StoryRow title="Primitives">
          <Viewport label="Button" width={720}>
            <ButtonStory />
          </Viewport>
          <Viewport label="Field" width={480}>
            <FieldStory />
          </Viewport>
          <Viewport label="Checkbox" width={480}>
            <CheckboxStory />
          </Viewport>
          <Viewport label="Surface" width={720}>
            <SurfaceStory />
          </Viewport>
        </StoryRow>

        <StoryRow title="Components">
          <Viewport label="Badge" width={560}>
            <BadgeStory />
          </Viewport>
          <Viewport label="Tabs" width={640}>
            <TabsStory />
          </Viewport>
          <Viewport label="Composition" width={720}>
            <CompositionStory />
          </Viewport>
          <Viewport label="Dialog" width={720}>
            <DialogStory />
          </Viewport>
        </StoryRow>
      </DesignSurface>
    </DesignTokens>
  )
}

const root = createRoot(document.documentElement)
root.render(<App />)
