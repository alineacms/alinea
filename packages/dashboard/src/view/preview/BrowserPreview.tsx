import {PreviewAction} from '@alinea/preview/RegisterPreview'
import {
  AppBar,
  fromModule,
  HStack,
  Loader,
  px,
  Typo,
  useObservable
} from '@alinea/ui'
import {IcRoundArrowBack} from '@alinea/ui/icons/IcRoundArrowBack'
import {IcRoundArrowForward} from '@alinea/ui/icons/IcRoundArrowForward'
import {IcRoundLock} from '@alinea/ui/icons/IcRoundLock'
import {IcRoundOpenInNew} from '@alinea/ui/icons/IcRoundOpenInNew'
import {IcRoundRefresh} from '@alinea/ui/icons/IcRoundRefresh'
import {useEffect, useRef, useState} from 'react'
import {DraftsStatus, useDrafts} from '../../hook/UseDrafts'
import {Preview} from '../Preview'
import css from './BrowserPreview.module.scss'

const styles = fromModule(css)

export type BrowserPreviewProps = {
  url: string
  prettyUrl?: string
  reload?: boolean
}

export function BrowserPreview({url, prettyUrl, reload}: BrowserPreviewProps) {
  const ref = useRef<HTMLIFrameElement>(null)
  const drafts = useDrafts()
  const status = useObservable(drafts.status)
  const [loading, setLoading] = useState(true)
  const hasPreviewListener = useRef(false)
  useEffect(() => {
    setLoading(true)

    function handleMessage(event: MessageEvent) {
      if (event.data === PreviewAction.Pong) hasPreviewListener.current = true
    }

    addEventListener('message', handleMessage)
    return () => removeEventListener('message', handleMessage)
  }, [url])
  useEffect(() => {
    if (status === DraftsStatus.Synced) {
      if (!reload && hasPreviewListener.current) handleRefetch()
      else handleReload()
    }
  }, [status])
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => setLoading(false), 3000)
      return () => clearTimeout(timeout)
    }
  }, [loading])

  function post(action: PreviewAction) {
    ref.current?.contentWindow?.postMessage(action, url)
  }

  function handlePrevious() {
    post(PreviewAction.Previous)
  }

  function handleNext() {
    post(PreviewAction.Next)
  }

  function handleReload() {
    if (hasPreviewListener.current) post(PreviewAction.Reload)
    else ref.current?.setAttribute('src', url)
    setLoading(true)
  }

  function handleRefetch() {
    post(PreviewAction.Refetch)
  }
  return (
    <Preview>
      <div className={styles.root()}>
        <AppBar.Root>
          <>
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
          </>
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
        </AppBar.Root>
        <div style={{flexGrow: 1, position: 'relative'}}>
          <div className={styles.root.loader({loading})}>
            <Loader />
          </div>
          <iframe
            ref={ref}
            key={url}
            className={styles.root.iframe()}
            allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
            sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock"
            src={url}
            onLoad={() => {
              setLoading(false)
              try {
                const contentWindow = ref.current?.contentWindow
                if (contentWindow)
                  contentWindow.postMessage(PreviewAction.Ping, url)
              } catch (e) {
                hasPreviewListener.current = false
              }
            }}
          />
        </div>
      </div>
    </Preview>
  )
}
