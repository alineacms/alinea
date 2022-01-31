import {AppBar, fromModule, HStack, px, Typo, useObservable} from '@alinea/ui'
import {useEffect, useRef} from 'react'
import {
  MdKeyboardArrowLeft,
  MdKeyboardArrowRight,
  MdLock,
  MdOpenInNew,
  MdRefresh
} from 'react-icons/md'
import {DraftsStatus, useDrafts} from '../hook/UseDrafts'
import css from './BrowserPreview.module.scss'

const styles = fromModule(css)

export type BrowserPreviewProps = {
  url: string
}

export function BrowserPreview({url}: BrowserPreviewProps) {
  const ref = useRef<HTMLIFrameElement>(null)
  const drafts = useDrafts()
  const status = useObservable(drafts.status)
  useEffect(() => {
    if (status === DraftsStatus.Synced)
      ref.current!.contentWindow!.location.reload()
  }, [status])
  return (
    <div className={styles.root()}>
      <AppBar.Root>
        <AppBar.Item as="button" icon={MdKeyboardArrowLeft} />
        <AppBar.Item as="button" icon={MdKeyboardArrowRight} />
        <AppBar.Item as="button" icon={MdRefresh} />
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
      <div style={{flexGrow: 1}}>
        <iframe
          ref={ref}
          className={styles.root.iframe()}
          allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
          sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock"
          src={url}
        />
      </div>
    </div>
  )
}
