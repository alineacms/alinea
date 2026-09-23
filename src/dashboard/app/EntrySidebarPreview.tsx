import {List, ListEmpty, PreviewFrame, PreviewToolbar} from '#/components.js'
import type {Preview} from '#/core/Preview.js'
import type {EntryAtoms, EntryLocaleAtoms} from '#/dashboard/atoms/entry.js'
import {previewMetadataAtom} from '#/dashboard/atoms/preview.js'
import {PreviewAction, type PreviewMessage} from '#/preview/PreviewMessage.js'
import {styler} from '@alinea/styler'
import {atom, useAtomValueRaw, useAtomValueRawSync, useSetAtom} from 'jotai'
import {useEffect, useMemo, useRef, useState} from 'react'
import {IcRoundVisibilityOff} from '../icons.js'
import css from './EntrySidebarPreview.module.css'

const styles = styler(css)

export interface EntrySidebarPreviewProps {
  entry: EntryAtoms
  localeData: EntryLocaleAtoms
}

export function EntrySidebarPreview({
  entry,
  localeData
}: EntrySidebarPreviewProps) {
  const preview = useAtomValueRaw(entry.preview)
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
  const previewEntry = useAtomValueRaw(localeData.previewEntry)
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

export interface EntrySidebarBrowserPreviewProps {
  localeData: Pick<EntryLocaleAtoms, 'previewUrlState' | 'retryPreviewUrl'> &
    Partial<
      Pick<EntryLocaleAtoms, 'previewPayloadSignal' | 'updatePreviewPayload'>
    >
}

export function EntrySidebarBrowserPreview({
  localeData
}: EntrySidebarBrowserPreviewProps) {
  const [previewUrlPending, previewUrl] = useAtomValueRawSync(
    localeData.previewUrlState
  )
  const retryPreviewUrl = useSetAtom(localeData.retryPreviewUrl)
  const payloadSignalAtom = localeData.previewPayloadSignal
  const payloadSignal = useAtomValueRaw(
    payloadSignalAtom ?? emptyPayloadSignalAtom
  )
  const updatePreviewPayload = useSetAtom(
    localeData.updatePreviewPayload ?? emptyPreviewPayloadAtom
  )
  const setMetadata = useSetAtom(previewMetadataAtom)
  const iframe = useRef<HTMLIFrameElement>(null)
  const previewPayload = useRef<string>()
  const hasPreviewListener = useRef(false)
  const previewWindows = useRef(new Set<Window>())
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
    const windows = previewWindows.current
    previewPayload.current = undefined
    function disconnect() {
      if (targetOrigin)
        for (const previewWindow of windows) {
          if (!previewWindow.closed)
            previewWindow.postMessage(
              {action: PreviewAction.Disconnect},
              targetOrigin
            )
        }
      windows.clear()
    }
    window.addEventListener('pagehide', disconnect)
    return () => {
      window.removeEventListener('pagehide', disconnect)
      disconnect()
    }
  }, [localeData, previewUrl, targetOrigin])

  useEffect(() => {
    if (!targetOrigin) return
    function handleMessage(event: MessageEvent<PreviewMessage>) {
      if (event.origin !== targetOrigin) return
      const source = event.source as Window | null
      const isFrame = source === iframe.current?.contentWindow
      if (!source || (!isFrame && !previewWindows.current.has(source))) return
      if (!event.data || typeof event.data !== 'object') return
      if (event.data.action === PreviewAction.Ping) {
        if (isFrame) hasPreviewListener.current = true
        source.postMessage({action: PreviewAction.Pong}, targetOrigin)
        if (previewPayload.current)
          source.postMessage(
            {action: PreviewAction.Preview, payload: previewPayload.current},
            targetOrigin
          )
      } else if (isFrame && event.data.action === PreviewAction.Meta) {
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
        if (!payload || !targetOrigin) return
        const message = {action: PreviewAction.Preview, payload}
        if (hasPreviewListener.current)
          iframe.current?.contentWindow?.postMessage(message, targetOrigin)
        for (const previewWindow of previewWindows.current) {
          if (previewWindow.closed) previewWindows.current.delete(previewWindow)
          else previewWindow.postMessage(message, targetOrigin)
        }
      })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [
    localeData,
    payloadSignal,
    previewUrl,
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
    else {
      retryPreviewUrl()
      setFrameVersion(version => version + 1)
    }
  }

  function openPreview() {
    if (!previewUrl || typeof window === 'undefined') return
    const href = new URL(previewUrl, location.href)
    href.searchParams.set('full', '')
    // Keep the opener so previews on other origins can connect via postMessage.
    const previewWindow = window.open(href.href, '_blank')
    if (previewWindow) previewWindows.current.add(previewWindow)
  }

  return (
    <div className={styles.EntrySidebarPreview()}>
      <PreviewToolbar
        labels={{reload: previewUrl ? 'Reload preview' : 'Retry preview'}}
        onBack={previewUrl ? () => post(PreviewAction.Previous) : undefined}
        onForward={previewUrl ? () => post(PreviewAction.Next) : undefined}
        onReload={reloadPreview}
        onOpen={previewUrl ? openPreview : undefined}
      />
      <PreviewFrame
        key={`${previewUrl}:${frameVersion}`}
        ref={iframe}
        title="Preview"
        src={previewUrl}
        loading={Boolean(previewUrl ? loading : previewUrlPending)}
        unavailable="Preview is currently unavailable."
        allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
        sandbox="allow-top-navigation allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock"
        onLoad={() => setLoading(false)}
      />
    </div>
  )
}

const emptyPayloadSignalAtom = atom(undefined)
const emptyPreviewPayloadAtom = atom(null, async () => undefined)
