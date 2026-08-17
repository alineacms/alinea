import {Button, List, ListEmpty, ProgressCircle} from '#/components.js'
import type {Preview} from '#/core/Preview.js'
import type {EntryAtoms, EntryLocaleAtoms} from '#/dashboard/atoms/entry.js'
import {previewMetadataAtom} from '#/dashboard/atoms/preview.js'
import {PreviewAction, type PreviewMessage} from '#/preview/PreviewMessage.js'
import {styler} from '@alinea/styler'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {useEffect, useMemo, useRef, useState} from 'react'
import {
  IcRoundArrowBack,
  IcRoundArrowForward,
  IcRoundOpenInNew,
  IcRoundRefresh,
  IcRoundVisibilityOff
} from '../icons.js'
import css from './EntrySidebarPreview.module.css'
import {RailHeader} from './ui/Rail.js'

const styles = styler(css)

export interface EntrySidebarPreviewProps {
  entry: EntryAtoms
  localeData: EntryLocaleAtoms
}

export function EntrySidebarPreview({
  entry,
  localeData
}: EntrySidebarPreviewProps) {
  const preview = useAtomValue(entry.preview)
  if (!preview)
    return (
      <EntrySidebarPreviewMessage title="No preview">
        This entry has no preview.
      </EntrySidebarPreviewMessage>
    )
  if (preview === true)
    return <EntrySidebarBrowserPreview localeData={localeData} />
  return (
    <EntrySidebarComponentPreview localeData={localeData} preview={preview} />
  )
}

interface EntrySidebarComponentPreviewProps {
  localeData: EntryLocaleAtoms
  preview: Exclude<Preview, boolean>
}

function EntrySidebarComponentPreview({
  localeData,
  preview: Component
}: EntrySidebarComponentPreviewProps) {
  const previewEntry = useAtomValue(localeData.previewEntry)
  if (!previewEntry)
    return (
      <EntrySidebarPreviewMessage title="Preview unavailable">
        Preview is currently unavailable.
      </EntrySidebarPreviewMessage>
    )
  return (
    <div className={styles.EntrySidebarPreview()}>
      <div className={styles.EntrySidebarPreview.component()}>
        <Component entry={previewEntry} />
      </div>
    </div>
  )
}

interface EntrySidebarPreviewMessageProps {
  children: string
  title: string
}

function EntrySidebarPreviewMessage({
  children,
  title
}: EntrySidebarPreviewMessageProps) {
  return (
    <div className={styles.EntrySidebarPreview()}>
      <div className={styles.EntrySidebarPreview.empty()}>
        <List aria-label="Preview" empty>
          <ListEmpty icon={IcRoundVisibilityOff} title={title}>
            {children}
          </ListEmpty>
        </List>
      </div>
    </div>
  )
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
          appearance="plain"
          size="icon"
          icon={IcRoundArrowBack}
          aria-label="Go back in preview"
          isDisabled={!canOpenPreview}
          onPress={onPrevious}
        />
        <Button
          appearance="plain"
          size="icon"
          icon={IcRoundArrowForward}
          aria-label="Go forward in preview"
          isDisabled={!canOpenPreview}
          onPress={onNext}
        />
        <Button
          appearance="plain"
          size="icon"
          icon={IcRoundRefresh}
          aria-label={reloadLabel}
          isDisabled={!onReload}
          onPress={onReload}
        />
      </div>
      <Button
        appearance="plain"
        size="icon"
        icon={IcRoundOpenInNew}
        aria-label="Open preview in new tab"
        isDisabled={!canOpenPreview}
        onPress={onOpen}
      />
    </RailHeader>
  )
}

export interface EntrySidebarBrowserPreviewProps {
  localeData: Pick<EntryLocaleAtoms, 'previewUrl' | 'retryPreviewUrl'> &
    Partial<
      Pick<EntryLocaleAtoms, 'previewPayloadSignal' | 'updatePreviewPayload'>
    >
}

export function EntrySidebarBrowserPreview({
  localeData
}: EntrySidebarBrowserPreviewProps) {
  const previewUrl = useAtomValue(localeData.previewUrl)
  const retryPreviewUrl = useSetAtom(localeData.retryPreviewUrl)
  const payloadSignalAtom = localeData.previewPayloadSignal
  const payloadSignal = useAtomValue(
    payloadSignalAtom ?? emptyPayloadSignalAtom
  )
  const updatePreviewPayload = useSetAtom(
    localeData.updatePreviewPayload ?? emptyPreviewPayloadAtom
  )
  const setMetadata = useSetAtom(previewMetadataAtom)
  const iframe = useRef<HTMLIFrameElement>(null)
  const previewPayload = useRef<string>()
  const hasPreviewListener = useRef(false)
  const [frameVersion, setFrameVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const targetOrigin = useMemo(() => {
    if (!previewUrl) return undefined
    const base =
      typeof location === 'undefined' ? 'http://localhost' : location.href
    return new URL(previewUrl, base).origin
  }, [previewUrl])

  useEffect(() => {
    setLoading(true)
    setFrameVersion(0)
    hasPreviewListener.current = false
    previewPayload.current = undefined
  }, [previewUrl])

  useEffect(() => {
    if (!targetOrigin) return
    function handleMessage(event: MessageEvent<PreviewMessage>) {
      if (event.origin !== targetOrigin) return
      if (event.source !== iframe.current?.contentWindow) return
      if (!event.data || typeof event.data !== 'object') return
      if (event.data.action === PreviewAction.Ping) {
        hasPreviewListener.current = true
        iframe.current?.contentWindow?.postMessage(
          {action: PreviewAction.Pong},
          targetOrigin
        )
        if (previewPayload.current)
          iframe.current?.contentWindow?.postMessage(
            {action: PreviewAction.Preview, payload: previewPayload.current},
            targetOrigin
          )
      } else if (event.data.action === PreviewAction.Meta) {
        setMetadata(event.data)
      }
    }
    addEventListener('message', handleMessage)
    return () => removeEventListener('message', handleMessage)
  }, [setMetadata, targetOrigin])

  useEffect(() => {
    if (!localeData.updatePreviewPayload) return
    let cancelled = false
    const timeout = setTimeout(() => {
      void updatePreviewPayload().then(payload => {
        if (cancelled) return
        previewPayload.current = payload
        if (!payload || !targetOrigin || !hasPreviewListener.current) return
        iframe.current?.contentWindow?.postMessage(
          {action: PreviewAction.Preview, payload},
          targetOrigin
        )
      })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [
    localeData.updatePreviewPayload,
    payloadSignal,
    targetOrigin,
    updatePreviewPayload
  ])

  function post(
    action: PreviewAction.Previous | PreviewAction.Next | PreviewAction.Reload
  ) {
    if (!targetOrigin) return
    iframe.current?.contentWindow?.postMessage({action}, targetOrigin)
  }

  function reloadPreview() {
    if (!previewUrl) return retryPreviewUrl()
    setLoading(true)
    if (hasPreviewListener.current) post(PreviewAction.Reload)
    else setFrameVersion(version => version + 1)
  }

  function openPreview() {
    if (!previewUrl || typeof window === 'undefined') return
    const href = `${previewUrl}${previewUrl.includes('?') ? '&' : '?'}full`
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={styles.EntrySidebarPreview()}>
      <EntrySidebarBrowserPreviewHeader
        canOpenPreview={Boolean(previewUrl)}
        reloadLabel={previewUrl ? 'Reload preview' : 'Retry preview'}
        onPrevious={() => post(PreviewAction.Previous)}
        onNext={() => post(PreviewAction.Next)}
        onReload={reloadPreview}
        onOpen={openPreview}
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

const emptyPayloadSignalAtom = atom(undefined)
const emptyPreviewPayloadAtom = atom(null, async () => undefined)
