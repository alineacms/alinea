import {
  AppBar,
  fromModule,
  HStack,
  Loader,
  px,
  Typo,
  useObservable
} from '@alinea/ui'
import {useEffect, useRef, useState} from 'react'
import {
  MdArrowBack,
  MdArrowForward,
  MdLock,
  MdOpenInNew,
  MdRefresh
} from 'react-icons/md'
import {DraftsStatus, useDrafts} from '../hook/UseDrafts'
import css from './BrowserPreview.module.scss'
import {Preview} from './Preview'

const styles = fromModule(css)

export type BrowserPreviewProps = {
  url: string
}

export function BrowserPreview({url}: BrowserPreviewProps) {
  const ref = useRef<HTMLIFrameElement>(null)
  const drafts = useDrafts()
  const status = useObservable(drafts.status)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
  }, [url])
  useEffect(() => {
    if (status === DraftsStatus.Synced) {
      ref.current?.contentWindow?.location.reload()
    }
  }, [status])
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => setLoading(false), 3000)
      return () => clearTimeout(timeout)
    }
  }, [loading])
  return (
    <Preview>
      <div className={styles.root()}>
        <AppBar.Root>
          <AppBar.Item
            as="button"
            icon={MdArrowBack}
            onClick={() => {
              ref.current?.contentWindow?.history.back()
            }}
          />
          <AppBar.Item
            as="button"
            icon={MdArrowForward}
            onClick={() => {
              ref.current?.contentWindow?.history.forward()
            }}
          />
          <AppBar.Item
            as="button"
            icon={MdRefresh}
            onClick={() => {
              ref.current?.contentWindow?.location.reload()
            }}
          />
          <AppBar.Item full style={{flexGrow: 1, minWidth: 0}}>
            <Typo.Monospace
              style={{
                display: 'block',
                width: '100%',
                background: 'var(--highlight)',
                padding: `${px(6)} ${px(15)}`,
                borderRadius: px(8)
              }}
            >
              <HStack gap={8} center>
                <MdLock style={{flexShrink: 0}} />
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
          <AppBar.Item as="a" icon={MdOpenInNew} href={url} target="_blank" />
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
            onLoad={() => setLoading(false)}
          />
        </div>
      </div>
    </Preview>
  )
}
