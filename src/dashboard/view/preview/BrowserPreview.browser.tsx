import {PreviewAction} from 'alinea/preview/RegisterPreview'
import {AppBar, fromModule, HStack, Loader, px, Stack, Typo} from 'alinea/ui'
import {useElementSize} from 'alinea/ui/hook/UseElementSize'
import {useLocalStorage} from 'alinea/ui/hook/UseLocalStorage'
import {IcBaselineDesktopMac} from 'alinea/ui/icons/IcBaselineDesktopMac'
import {IcBaselinePhoneIphone} from 'alinea/ui/icons/IcBaselinePhoneIphone'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import {IcRoundArrowForward} from 'alinea/ui/icons/IcRoundArrowForward'
import {IcRoundLock} from 'alinea/ui/icons/IcRoundLock'
import {IcRoundNorthEast} from 'alinea/ui/icons/IcRoundNorthEast'
import {IcRoundOpenInNew} from 'alinea/ui/icons/IcRoundOpenInNew'
import {IcRoundRefresh} from 'alinea/ui/icons/IcRoundRefresh'
import {IcRoundSouthWest} from 'alinea/ui/icons/IcRoundSouthWest'
import {IcRoundTabletMac} from 'alinea/ui/icons/IcRoundTabletMac'
import {CSSProperties, useEffect, useRef, useState} from 'react'
import {Preview} from '../Preview.browser.js'
import {Sidebar} from '../Sidebar.js'
import css from './BrowserPreview.module.scss'

const styles = fromModule(css)

enum Display {
  Mobile,
  Tablet,
  Desktop
}

const displayWidth = {
  [Display.Mobile]: undefined,
  [Display.Tablet]: 768,
  [Display.Desktop]: 1200
}

export type BrowserPreviewProps = {
  url: string
  prettyUrl?: string
  reload?: boolean
}

export function BrowserPreview({url, prettyUrl, reload}: BrowserPreviewProps) {
  const [display, setDisplay] = useLocalStorage<Display>(
    '@alinea/dashboard/preview',
    Display.Mobile
  )
  const [mini, setMini] = useLocalStorage<boolean>(
    '@alinea/dashboard/preview/mini',
    false
  )
  const iframe = useRef<HTMLIFrameElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const miniContainer = useRef<HTMLDivElement>(null)
  const {width, height} = useElementSize(mini ? miniContainer : container)
  const [loading, setLoading] = useState(true)
  const hasPreviewListener = useRef(false)
  const origin = new URL(url, window.location.href)
  const target = `${origin.protocol}//${origin.host}`
  const previewWidth = displayWidth[display]
  const aspectRatio = previewWidth && width && width / previewWidth
  const previewHeight =
    (height && aspectRatio && height / aspectRatio) || undefined

  const sizing: CSSProperties = {
    width: previewWidth,
    height: previewHeight,
    transformOrigin: '0 0',
    transform:
      previewWidth && previewHeight && width
        ? `scale(${aspectRatio})`
        : undefined
  }

  useEffect(() => {
    setLoading(true)

    function handleMessage(event: MessageEvent) {
      if (event.data === PreviewAction.Pong) {
        console.log('[Alinea preview window detected]')
        hasPreviewListener.current = true
      }
    }

    addEventListener('message', handleMessage)
    return () => removeEventListener('message', handleMessage)
  }, [url])

  /*useEffect(() => {
    if (status === DraftsStatus.Synced) {
      if (!reload && hasPreviewListener.current) handleRefetch()
      else handleReload()
    }
  }, [status])*/

  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => setLoading(false), 3000)
      return () => clearTimeout(timeout)
    }
  }, [loading])

  function post(action: PreviewAction) {
    iframe.current?.contentWindow?.postMessage(action, target)
  }

  function handlePrevious() {
    post(PreviewAction.Previous)
  }

  function handleNext() {
    post(PreviewAction.Next)
  }

  function handleReload() {
    if (hasPreviewListener.current) post(PreviewAction.Reload)
    else iframe.current?.setAttribute('src', url)
    setLoading(true)
  }

  function handleRefetch() {
    post(PreviewAction.Refetch)
  }

  const inner = (
    <>
      <div
        style={{
          flexGrow: 1,
          position: 'relative',
          overflow: 'hidden'
        }}
        ref={mini ? miniContainer : container}
      >
        <div className={styles.root.loader({loading})}>
          <Loader />
        </div>
        <iframe
          ref={iframe}
          key={url}
          className={styles.root.iframe()}
          allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
          sandbox="allow-top-navigation allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock"
          src={url}
          onLoad={() => {
            setLoading(false)
            try {
              const contentWindow = iframe.current?.contentWindow
              if (contentWindow)
                contentWindow.postMessage(PreviewAction.Ping, target)
            } catch (e) {
              hasPreviewListener.current = false
            }
          }}
          style={sizing}
        />
      </div>
    </>
  )

  const {isPreviewOpen, togglePreview} = Sidebar.use()

  if (mini) {
    if (!isPreviewOpen) return null
    return (
      <div className={styles.mini()}>
        {inner}

        <AppBar.Root className={styles.mini.footer()}>
          <HStack>
            <AppBar.Item
              as="button"
              icon={IcBaselinePhoneIphone}
              onClick={() => setDisplay(Display.Mobile)}
              active={display === Display.Mobile}
            />
            <AppBar.Item
              as="button"
              icon={IcRoundTabletMac}
              onClick={() => setDisplay(Display.Tablet)}
              active={display === Display.Tablet}
            />
            <AppBar.Item
              as="button"
              icon={IcBaselineDesktopMac}
              onClick={() => setDisplay(Display.Desktop)}
              active={display === Display.Desktop}
            />
            <Stack.Right>
              <AppBar.Item
                as="button"
                icon={mini ? IcRoundNorthEast : IcRoundSouthWest}
                onClick={() => setMini(!mini)}
              />
            </Stack.Right>
          </HStack>
        </AppBar.Root>
      </div>
    )
  }

  return (
    <Preview>
      <div className={styles.root()}>
        <AppBar.Root>
          <HStack style={{height: '100%'}}>
            <AppBar.Item
              as="button"
              icon={IcRoundArrowBack}
              onClick={handlePrevious}
            />
            <AppBar.Item
              as="button"
              icon={IcRoundArrowForward}
              onClick={handleNext}
            />
            <AppBar.Item
              as="button"
              icon={IcRoundRefresh}
              onClick={handleReload}
            />
            <AppBar.Item full style={{flexGrow: 1, minWidth: 0}}>
              <Typo.Monospace
                style={{
                  display: 'block',
                  width: '100%',
                  background: 'var(--alinea-highlight)',
                  padding: `${px(6)} ${px(15)}`,
                  borderRadius: px(8)
                }}
              >
                <HStack gap={8} center>
                  <IcRoundLock style={{flexShrink: 0}} />
                  <span
                    style={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {prettyUrl || url}
                  </span>
                </HStack>
              </Typo.Monospace>
            </AppBar.Item>
            <AppBar.Item
              as="a"
              icon={IcRoundOpenInNew}
              href={url}
              target="_blank"
            />
          </HStack>
        </AppBar.Root>
        {inner}
        <AppBar.Root>
          <AppBar.Item
            as="button"
            icon={IcBaselinePhoneIphone}
            onClick={() => setDisplay(Display.Mobile)}
            active={display === Display.Mobile}
          />
          <AppBar.Item
            as="button"
            icon={IcRoundTabletMac}
            onClick={() => setDisplay(Display.Tablet)}
            active={display === Display.Tablet}
          />
          <AppBar.Item
            as="button"
            icon={IcBaselineDesktopMac}
            onClick={() => setDisplay(Display.Desktop)}
            active={display === Display.Desktop}
          />
          <Stack.Right>
            <AppBar.Item
              as="button"
              icon={mini ? IcRoundNorthEast : IcRoundSouthWest}
              onClick={() => setMini(!mini)}
            />
          </Stack.Right>
        </AppBar.Root>
      </div>
    </Preview>
  )
}
