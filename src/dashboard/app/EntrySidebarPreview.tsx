import {Button, ProgressCircle} from '#/components.js'
import type {Preview} from '#/core/Preview.js'
import {PreviewAction, type PreviewMessage} from '#/preview/PreviewMessage.js'
import {styler} from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import {Suspense, useEffect, useMemo, useRef, useState} from 'react'
import {
  IcRoundArrowBack,
  IcRoundArrowForward,
  IcRoundOpenInNew,
  IcRoundRefresh
} from '../icons.js'
import {DashboardEntryData, useDashboard} from '../store.js'
import css from './EntrySidebarPreview.module.css'
import {RailHeader} from './ui/Rail.js'

const styles = styler(css)

export interface EntrySidebarPreviewProps {
  entry: DashboardEntryData
}

export function EntrySidebarPreview({entry}: EntrySidebarPreviewProps) {
  const preview = useAtomValue(entry.preview)
  if (!preview)
    return (
      <EntrySidebarPreviewMessage>
        This entry has no preview.
      </EntrySidebarPreviewMessage>
    )
  if (preview === true)
    return (
      <Suspense fallback={<EntrySidebarBrowserPreviewFallback />}>
        <EntrySidebarBrowserPreview entry={entry} />
      </Suspense>
    )
  return <EntrySidebarComponentPreview entry={entry} preview={preview} />
}

interface EntrySidebarPreviewMessageProps {
  children: string
}

function EntrySidebarPreviewMessage({
  children
}: EntrySidebarPreviewMessageProps) {
  return (
    <div className={styles.EntrySidebarPreview()}>
      <p className={styles.EntrySidebarPreview.message()}>{children}</p>
    </div>
  )
}

interface EntrySidebarComponentPreviewProps {
  entry: DashboardEntryData
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
  entry: DashboardEntryData
}

interface EntrySidebarBrowserPreviewHeaderProps {
  canOpenPreview: boolean
  reloadLabel: string
  onPrevious?: () => void
  onNext?: () => void
  onReload?: () => void
  onOpen?: () => void
}

function EntrySidebarBrowserPreviewHeader({
  canOpenPreview,
  reloadLabel,
  onPrevious,
  onNext,
  onReload,
  onOpen
}: EntrySidebarBrowserPreviewHeaderProps) {
  return (
    <RailHeader className={styles.EntrySidebarPreview.subheader()}>
      <div className={styles.EntrySidebarPreview.controls()}>
        <Button
          appearance="outline"
          size="icon"
          icon={IcRoundArrowBack}
          aria-label="Go back in preview"
          isDisabled={!canOpenPreview}
          onPress={onPrevious}
        />
        <Button
          appearance="outline"
          size="icon"
          icon={IcRoundArrowForward}
          aria-label="Go forward in preview"
          isDisabled={!canOpenPreview}
          onPress={onNext}
        />
        <Button
          appearance="outline"
          size="icon"
          icon={IcRoundRefresh}
          aria-label={reloadLabel}
          isDisabled={!onReload}
          onPress={onReload}
        />
      </div>
      <Button
        appearance="outline"
        size="icon"
        icon={IcRoundOpenInNew}
        aria-label="Open preview in new tab"
        isDisabled={!canOpenPreview}
        onPress={onOpen}
      />
    </RailHeader>
  )
}

function EntrySidebarBrowserPreviewFallback() {
  return (
    <div className={styles.EntrySidebarPreview()}>
      <EntrySidebarBrowserPreviewHeader
        canOpenPreview={false}
        reloadLabel="Reload preview"
      />
      <div className={styles.EntrySidebarPreview.browser()}>
        <div className={styles.EntrySidebarPreview.loading()}>
          <ProgressCircle isIndeterminate aria-label="Loading preview" />
        </div>
      </div>
    </div>
  )
}

function EntrySidebarBrowserPreview({entry}: EntrySidebarBrowserPreviewProps) {
  const previewUrl = useAtomValue(entry.previewUrl)
  const previewPayloadSignal = useAtomValue(entry.previewPayloadSignal)
  const updatePreviewPayload = useSetAtom(entry.updatePreviewPayload)
  const retryPreviewUrl = useSetAtom(entry.retryPreviewUrl)
  const iframe = useRef<HTMLIFrameElement>(null)
  const previewPayload = useRef<string | undefined>(undefined)
  const [frameVersion, setFrameVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const hasPreviewListener = useRef(false)
  const dashboard = useDashboard()
  const setMetadata = useSetAtom(dashboard.previewMetadata)

  const targetOrigin = useMemo(() => {
    if (!previewUrl) return undefined
    const baseHref =
      typeof location === 'undefined' ? 'http://localhost' : location.href
    return new URL(previewUrl, baseHref).origin
  }, [previewUrl])

  useEffect(() => {
    setLoading(true)
    setFrameVersion(0)
    hasPreviewListener.current = false
  }, [previewUrl, targetOrigin])

  useEffect(() => {
    if (!targetOrigin) return
    function handleMessage(event: MessageEvent<PreviewMessage>) {
      if (!event.data || typeof event.data !== 'object') return
      if (event.origin !== targetOrigin) return
      if (event.data.action === PreviewAction.Ping) {
        hasPreviewListener.current = true
        iframe.current?.contentWindow?.postMessage(
          {action: PreviewAction.Pong},
          targetOrigin
        )
        if (previewPayload.current) {
          iframe.current?.contentWindow?.postMessage(
            {action: PreviewAction.Preview, payload: previewPayload.current},
            targetOrigin
          )
        }
        return
      }
      if (event.data.action === PreviewAction.Meta) {
        setMetadata(event.data)
      }
    }
    addEventListener('message', handleMessage)
    return () => removeEventListener('message', handleMessage)
  }, [targetOrigin, setMetadata])

  useEffect(() => {
    let cancelled = false
    void updatePreviewPayload().then(payload => {
      if (cancelled) return
      previewPayload.current = payload
      if (!payload) return
      if (!targetOrigin || !hasPreviewListener.current) return
      iframe.current?.contentWindow?.postMessage(
        {action: PreviewAction.Preview, payload},
        targetOrigin
      )
    })
    return () => {
      cancelled = true
    }
  }, [previewPayloadSignal, targetOrigin, updatePreviewPayload])

  useEffect(() => {
    if (!previewUrl) {
      previewPayload.current = undefined
      return
    }
  }, [previewUrl])

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
    if (!previewUrl) {
      retryPreviewUrl()
      return
    }
    setLoading(true)
    if (hasPreviewListener.current) post(PreviewAction.Reload)
    else setFrameVersion(version => version + 1)
  }

  return (
    <div className={styles.EntrySidebarPreview()}>
      <EntrySidebarBrowserPreviewHeader
        canOpenPreview={Boolean(previewUrl)}
        reloadLabel={previewUrl ? 'Reload preview' : 'Retry preview'}
        onPrevious={() => post(PreviewAction.Previous)}
        onNext={() => post(PreviewAction.Next)}
        onReload={reloadPreview}
        onOpen={openInNewTab}
      />
      <div className={styles.EntrySidebarPreview.browser()}>
        {previewUrl && loading && (
          <div className={styles.EntrySidebarPreview.loading()}>
            <ProgressCircle isIndeterminate aria-label="Loading preview" />
          </div>
        )}
        {previewUrl ? (
          <iframe
            key={`${previewUrl}:${frameVersion}`}
            ref={iframe}
            className={styles.EntrySidebarPreview.iframe()}
            allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
            sandbox="allow-top-navigation allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock"
            src={previewUrl}
            onLoad={() => setLoading(false)}
          />
        ) : (
          <p className={styles.EntrySidebarPreview.browserMessage()}>
            Preview is currently unavailable.
          </p>
        )}
      </div>
    </div>
  )
}
