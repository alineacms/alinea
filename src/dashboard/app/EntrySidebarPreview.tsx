import {Button, ProgressCircle} from '#/components.js'
import type {Preview} from '#/core/Preview.js'
import {PreviewAction, type PreviewMessage} from '#/preview/PreviewMessage.js'
import {styler} from '@alinea/styler'
import {useAtomValue} from 'jotai'
import {useEffect, useMemo, useRef, useState} from 'react'
import {
  IcRoundArrowBack,
  IcRoundArrowForward,
  IcRoundOpenInNew,
  IcRoundRefresh
} from '../icons.js'
import {DashboardEntry} from '../store.js'
import css from './EntrySidebarPreview.module.css'

const styles = styler(css)

export interface EntrySidebarPreviewProps {
  entry: DashboardEntry
}

export function EntrySidebarPreview({entry}: EntrySidebarPreviewProps) {
  const preview = useAtomValue(entry.preview)
  if (!preview)
    return (
      <EntrySidebarPreviewMessage>
        This entry has no preview.
      </EntrySidebarPreviewMessage>
    )
  if (preview === true) return <EntrySidebarBrowserPreview entry={entry} />
  return <EntrySidebarComponentPreview entry={entry} preview={preview} />
}

interface EntrySidebarPreviewMessageProps {
  children: string
}

function EntrySidebarPreviewMessage({children}: EntrySidebarPreviewMessageProps) {
  return (
    <div className={styles.EntrySidebarPreview()}>
      <p className={styles.EntrySidebarPreview.message()}>{children}</p>
    </div>
  )
}

interface EntrySidebarComponentPreviewProps {
  entry: DashboardEntry
  preview: Exclude<Preview, boolean>
}

function EntrySidebarComponentPreview({
  entry,
  preview
}: EntrySidebarComponentPreviewProps) {
  const previewEntry = useAtomValue(entry.previewEntry)
  if (!previewEntry)
    return (
      <EntrySidebarPreviewMessage>
        Preview is currently unavailable.
      </EntrySidebarPreviewMessage>
    )
  const Component = preview
  return (
    <div className={styles.EntrySidebarPreview()}>
      <div className={styles.EntrySidebarPreview.component()}>
        <Component entry={previewEntry} />
      </div>
    </div>
  )
}

interface EntrySidebarBrowserPreviewProps {
  entry: DashboardEntry
}

function EntrySidebarBrowserPreview({entry}: EntrySidebarBrowserPreviewProps) {
  const previewUrl = useAtomValue(entry.previewUrl)
  const iframe = useRef<HTMLIFrameElement>(null)
  const [frameVersion, setFrameVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [hasPreviewListener, setHasPreviewListener] = useState(false)
  const targetOrigin = useMemo(() => {
    if (!previewUrl) return undefined
    const baseHref =
      typeof location === 'undefined' ? 'http://localhost' : location.href
    return new URL(previewUrl, baseHref).origin
  }, [previewUrl])

  useEffect(() => {
    setLoading(true)
    setHasPreviewListener(false)
  }, [previewUrl, frameVersion])

  useEffect(() => {
    if (!targetOrigin) return
    function handleMessage(event: MessageEvent<PreviewMessage>) {
      if (!event.data || typeof event.data !== 'object') return
      if (event.origin !== targetOrigin) return
      if (event.data.action === PreviewAction.Ping) {
        setHasPreviewListener(true)
        iframe.current?.contentWindow?.postMessage(
          {action: PreviewAction.Pong},
          targetOrigin
        )
      }
    }
    addEventListener('message', handleMessage)
    return () => removeEventListener('message', handleMessage)
  }, [targetOrigin])

  function post(
    action: PreviewAction.Previous | PreviewAction.Next | PreviewAction.Reload
  ) {
    if (!targetOrigin) return
    iframe.current?.contentWindow?.postMessage({action}, targetOrigin)
  }

  function openInNewTab() {
    if (!previewUrl || typeof window === 'undefined') return
    const href = `${previewUrl}${previewUrl.includes('?') ? '&' : '?'}full`
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  function reloadPreview() {
    setLoading(true)
    if (hasPreviewListener) post(PreviewAction.Reload)
    else setFrameVersion(version => version + 1)
  }

  if (!previewUrl)
    return (
      <EntrySidebarPreviewMessage>
        Preview is currently unavailable.
      </EntrySidebarPreviewMessage>
    )

  return (
    <div className={styles.EntrySidebarPreview()}>
      <div className={styles.EntrySidebarPreview.subheader()}>
        <div className={styles.EntrySidebarPreview.controls()}>
          <Button
            appearance="outline"
            size="icon"
            icon={IcRoundArrowBack}
            aria-label="Go back in preview"
            onPress={() => post(PreviewAction.Previous)}
          />
          <Button
            appearance="outline"
            size="icon"
            icon={IcRoundArrowForward}
            aria-label="Go forward in preview"
            onPress={() => post(PreviewAction.Next)}
          />
          <Button
            appearance="outline"
            size="icon"
            icon={IcRoundRefresh}
            aria-label="Reload preview"
            onPress={reloadPreview}
          />
        </div>
        <Button
          appearance="outline"
          size="icon"
          icon={IcRoundOpenInNew}
          aria-label="Open preview in new tab"
          onPress={openInNewTab}
        />
      </div>
      <div className={styles.EntrySidebarPreview.browser()}>
        {loading && (
          <div className={styles.EntrySidebarPreview.loading()}>
            <ProgressCircle isIndeterminate aria-label="Loading preview" />
          </div>
        )}
        <iframe
          key={`${previewUrl}:${frameVersion}`}
          ref={iframe}
          className={styles.EntrySidebarPreview.iframe()}
          allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
          sandbox="allow-top-navigation allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock"
          src={previewUrl}
          onLoad={() => setLoading(false)}
        />
      </div>
    </div>
  )
}
