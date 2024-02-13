import {PreviewAction, PreviewMessage} from 'alinea/preview/PreviewMessage'
import {HStack, Loader, Typo, fromModule, px} from 'alinea/ui'
import {AppBar} from 'alinea/ui/AppBar'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import {IcRoundArrowForward} from 'alinea/ui/icons/IcRoundArrowForward'
import {IcRoundLock} from 'alinea/ui/icons/IcRoundLock'
import {IcRoundOpenInNew} from 'alinea/ui/icons/IcRoundOpenInNew'
import {IcRoundRefresh} from 'alinea/ui/icons/IcRoundRefresh'
import {useEffect, useRef, useState} from 'react'
import {LivePreview} from '../entry/EntryPreview.js'
import css from './BrowserPreview.module.scss'

const styles = fromModule(css)

export interface BrowserPreviewProps {
  url: string
  registerLivePreview(api: LivePreview): void
}

export function BrowserPreview({
  url,
  registerLivePreview
}: BrowserPreviewProps) {
  const iframe = useRef<HTMLIFrameElement>(null)
  const [loading, setLoading] = useState(true)
  const hasPreviewListener = useRef(false)
  const origin = new URL(url, window.location.href)
  const target = `${origin.protocol}//${origin.host}`

  useEffect(() => {
    setLoading(true)

    function handleMessage(event: MessageEvent<PreviewMessage>) {
      if (!event.data || typeof event.data !== 'object') return
      if (event.data.action === PreviewAction.Pong) {
        console.log('[Alinea preview window detected]')
        hasPreviewListener.current = true
        registerLivePreview({
          preview(update) {
            post({action: PreviewAction.Preview, ...update})
          }
        })
      }
    }

    addEventListener('message', handleMessage)
    return () => removeEventListener('message', handleMessage)
  }, [url])

  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => setLoading(false), 3000)
      return () => clearTimeout(timeout)
    }
  }, [loading])

  function post(message: PreviewMessage) {
    iframe.current?.contentWindow?.postMessage(message, target)
  }

  function handlePrevious() {
    post({action: PreviewAction.Previous})
  }

  function handleNext() {
    post({action: PreviewAction.Next})
  }

  function handleReload() {
    if (hasPreviewListener.current) post({action: PreviewAction.Reload})
    else iframe.current?.setAttribute('src', url)
    setLoading(true)
  }

  const inner = (
    <>
      <div
        style={{
          flexGrow: 1,
          position: 'relative',
          overflow: 'hidden'
        }}
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
              post({action: PreviewAction.Ping})
            } catch (e) {
              hasPreviewListener.current = false
            }
          }}
        />
      </div>
    </>
  )

  return (
    <div className={styles.root()}>
      <AppBar.Root className={styles.root.bar()}>
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
                  {url}
                </span>
              </HStack>
            </Typo.Monospace>
          </AppBar.Item>
          <AppBar.Item
            as="a"
            icon={IcRoundOpenInNew}
            href={url + '&full'}
            target="_blank"
          />
        </HStack>
      </AppBar.Root>
      {inner}
    </div>
  )
}
