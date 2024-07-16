'use client'

import {chunkCookieValue} from 'alinea/preview/ChunkCookieValue'
import {
  PREVIEW_CONTENT_HASH_NAME,
  PREVIEW_ENTRYID_NAME,
  PREVIEW_PHASE_NAME,
  PREVIEW_UPDATE_NAME
} from 'alinea/preview/PreviewConstants'
import {usePreview} from 'alinea/preview/react'
// @ts-ignore
import {IcRoundEdit} from 'alinea/ui/icons/IcRoundEdit'
import {IcRoundExitToApp} from 'alinea/ui/icons/IcRoundExitToApp'
import {usePathname, useRouter} from 'next/navigation.js'
import {PropsWithChildren, useEffect, useState} from 'react'
import {createPortal} from 'react-dom'
import {PreviewUpdate} from '../Resolver.js'
import {User} from '../User.js'

const MAX_CHUNKS = 5

const styles = `
  :host {
    display: contents;
  }
  .previews {
    position: fixed;
    bottom: 15px;
    left: 0;
    z-index: 9999;
  }
  .inner {
    display: flex;
    align-items: center;
    background: #fff;
    border-radius: 17.5px;
    box-shadow: 0 0 1.4px rgba(0,0,0,.1), 0 2px 3.5px rgba(0,0,0,.1);
    z-index: 1000;
    height: 35px;
    font-size: 14px;
    font-family: system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
    transform: translateX(-50%);
    border: 1.5px solid #E4E4E7;
    transition: border 0.2s ease-out;
    animation: fade-in 0.3s ease-out;
  }
  .inner.is-centered {
    border-color: #8189e5;
  }
  .inner[data-dragging="true"] {
    cursor: grabbing;
  }
  .inner[data-dragging="true"] * {
    pointer-events: none;
  }
  .logo {
    display: block;
    height: 25px;
    width: auto;
    flex-shrink: 0;
  }
  .icon {
    display: block;
    font-size: 16px;
  }
  .button {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    color: #596e8d;
    white-space: nowrap;
    height: 100%;
    width: 45px;
    border-radius: 5px;
  }
  .button:hover {
    color: #000;
  }
  .separator {
    display: block;
    border-left: 1px solid #E4E4E7;
    height: 16px;
  }
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translate(-50%, 10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%);
    }
  }
`

function PreviewWidget({dashboardUrl, workspace, root}: NextPreviewsProps) {
  const [closed, setClosed] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const adminUrl = new URL(dashboardUrl, location.origin)
  const entryParams = new URLSearchParams({url: pathname})
  if (workspace) entryParams.set('workspace', workspace)
  if (root) entryParams.set('root', root)
  const entryUrl = new URL(`#/edit?${entryParams}`, adminUrl)
  const {isPreviewing} = usePreview({
    async preview(update) {
      setPreviewCookies(update)
      router.refresh()
    }
  })

  const [xPosition, setXPosition] = useState(0.5)
  const [isDragging, setIsDragging] = useState(false)
  const isCentered = Math.abs(xPosition - 0.5) < 0.05

  function startDrag(event: React.MouseEvent) {
    event.preventDefault()
    let current = xPosition
    const startX = event.clientX
    const startOffset = xPosition
    const windowWidth = window.innerWidth
    const containerWidth = (event.currentTarget as HTMLElement).clientWidth
    const minOffset = containerWidth / 2
    function move(event: MouseEvent) {
      setIsDragging(true)
      const deltaX = event.clientX - startX
      let newX = Math.max(0, Math.min(1, startOffset + deltaX / windowWidth))
      const min = minOffset / windowWidth
      if (newX < min) newX = min
      const max = 1 - min
      if (newX > max) newX = max
      current = newX
      setXPosition(newX)
    }
    function stop() {
      const isCentered = Math.abs(current - 0.5) < 0.05
      if (isCentered) setXPosition(0.5)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', stop)
      setTimeout(() => setIsDragging(false), 0)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', stop)
  }

  function exitPreview() {
    const expiry = new Date(Date.now() - 10_000)
    document.cookie = `${PREVIEW_ENTRYID_NAME}=;expires=${expiry.toUTCString()};path=/`
    document.cookie = `${PREVIEW_PHASE_NAME}=;expires=${expiry.toUTCString()};path=/`
    router.refresh()
    setClosed(true)
  }

  useEffect(() => {
    const reset = () => setXPosition(0.5)
    window.addEventListener('resize', reset)
    return () => window.removeEventListener('resize', reset)
  }, [])

  if (closed) return null
  return (
    <ShadowRoot>
      <style>{styles}</style>
      <div
        className="previews"
        style={{
          left: `${xPosition * 100}%`
        }}
        onMouseDown={startDrag}
      >
        <div
          className={`inner` + (isCentered ? ` is-centered` : ``)}
          data-dragging={isDragging}
        >
          <a
            href={String(adminUrl)}
            target="_top"
            className="button"
            title="Admin panel"
          >
            <svg
              className="logo"
              viewBox="0 0 36 36"
              preserveAspectRatio="none"
            >
              <path
                fill="#5763E6"
                d="M20.8178 10.3977V11.733C19.8978 10.6534 18.5316 10 16.6636 10C13.0112 10 10 13.267 10 17.5C10 21.733 13.0112 25 16.6636 25C18.5316 25 19.8978 24.3466 20.8178 23.267V24.6023H25V10.3977H20.8178ZM17.5 20.9659C15.5762 20.9659 14.1822 19.6307 14.1822 17.5C14.1822 15.3693 15.5762 14.0341 17.5 14.0341C19.4238 14.0341 20.8178 15.3693 20.8178 17.5C20.8178 19.6307 19.4238 20.9659 17.5 20.9659Z"
              />
            </svg>
          </a>
          <span className="separator" />
          <a
            href={String(entryUrl)}
            target="_top"
            className="button"
            title="Edit content"
          >
            <IcRoundEdit className="icon" />
          </a>
          <span className="separator" />
          <button onClick={exitPreview} className="button" title="Exit preview">
            <IcRoundExitToApp className="icon" />
          </button>
        </div>
      </div>
    </ShadowRoot>
  )
}

export interface NextPreviewsProps {
  user: User
  dashboardUrl: string
  workspace?: string
  root?: string
  widget?: boolean
}

async function setPreviewCookies({
  entryId,
  contentHash,
  phase,
  update
}: PreviewUpdate) {
  const chunks = chunkCookieValue(PREVIEW_UPDATE_NAME, update)

  // Todo: if we reached the limit show the user a modal or indication in
  // the UI that previewing will be temporarily disabled until the changes
  // are saved or published
  if (chunks.length > MAX_CHUNKS) {
    console.warn('Too many chunks, previewing will be disabled')
    return
  }

  const now = Date.now()
  const expiry = new Date(now + 10_000)
  document.cookie = `${PREVIEW_ENTRYID_NAME}=${entryId};expires=${expiry.toUTCString()};path=/`
  document.cookie = `${PREVIEW_CONTENT_HASH_NAME}=${contentHash};expires=${expiry.toUTCString()};path=/`
  document.cookie = `${PREVIEW_PHASE_NAME}=${phase};expires=${expiry.toUTCString()};path=/`
  for (const {name, value} of chunks) {
    document.cookie = `${name}=${value};expires=${expiry.toUTCString()};path=/`
  }
}

export default function NextPreviews(props: NextPreviewsProps) {
  if (!props.widget) return <WithoutWidget />
  return <PreviewWidget {...props} />
}

function WithoutWidget() {
  const router = useRouter()
  const {isPreviewing} = usePreview({
    async preview(update) {
      setPreviewCookies(update)
      router.refresh()
    }
  })
  return null
}

function ShadowRoot({children}: PropsWithChildren) {
  const [root, setRoot] = useState<ShadowRoot | null>(null)
  return (
    <div
      ref={el => {
        if (el && !root) setRoot(el.attachShadow({mode: 'closed'}))
      }}
    >
      {root && createPortal(children, root)}
    </div>
  )
}
