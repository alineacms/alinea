'use client'

import {setPreviewCookies} from '#/preview/PreviewCookies.js'
import {usePreview} from '#/preview/react.js'
import {type PreviewStats, registerPreviewWidget} from '#/preview/widget.js'
import {usePathname, useRouter} from 'next/navigation.js'
import {useEffect, useRef, useState, useTransition} from 'react'

export interface NextPreviewsProps {
  dashboardUrl: string
  widget?: boolean
  /** Resolves once the render's CMS queries settled. */
  stats?: Promise<PreviewStats>
  root?: string
  workspace?: string
}

export default function NextPreviews({
  dashboardUrl,
  widget,
  stats,
  root,
  workspace
}: NextPreviewsProps) {
  const refresh = useRouterRefresh()
  const [isLoading, setIsLoading] = useState(false)
  const [previewDisabled, setPreviewDisabled] = useState(false)
  const [renderStats, setRenderStats] = useState<string>()
  const pathname = usePathname()
  const adminUrl = new URL(dashboardUrl, location.origin)
  const host = window.parent !== window ? window.parent : window.opener
  let hostOrigin = adminUrl.origin
  try {
    if (host?.location.origin === location.origin) hostOrigin = location.origin
  } catch {
    // A cross-origin dashboard is expected when using the CLI directly.
  }
  const entryParams = new URLSearchParams({url: pathname})
  if (workspace) entryParams.set('workspace', workspace)
  if (root) entryParams.set('root', root)
  const editUrl = new URL(`#/edit?${entryParams}`, adminUrl)
  const {isPreviewing} = usePreview({
    hostOrigin,
    async preview(update) {
      if (!update) return
      const success = await setPreviewCookies(update.payload)
      setPreviewDisabled(!success)
      if (!success) return
      setIsLoading(true)
      refresh().then(() => setIsLoading(false))
    }
  })
  // oxlint-disable react-you-might-not-need-an-effect/no-event-handler -- Register the external preview web component when requested.
  useEffect(() => {
    if (widget) registerPreviewWidget()
  }, [widget])
  /* oxlint-enable react-you-might-not-need-an-effect/no-event-handler */
  // Each render streams new stats; waiting here keeps refreshes unblocked.
  useEffect(() => {
    let current = true
    stats?.then(value => {
      if (current) setRenderStats(JSON.stringify(value))
    })
    return () => {
      current = false
    }
  }, [stats])
  if (!widget) return null
  return (
    <alinea-preview
      adminUrl={String(adminUrl)}
      editUrl={String(editUrl)}
      livePreview={
        isPreviewing
          ? isLoading
            ? 'loading'
            : previewDisabled
              ? 'warning'
              : 'connected'
          : undefined
      }
      stats={renderStats}
    />
  )
}

// https://github.com/vercel/next.js/discussions/58520#discussioncomment-9605299

/**
 * Wrapper around `router.refresh()` from `next/navigation` `useRouter()` to return Promise, and resolve after refresh completed
 * @returns Refresh function
 */
export function useRouterRefresh() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const resolveRefresh = useRef<(() => void) | undefined>(undefined)
  const wasPending = useRef(false)

  const refresh = () => {
    return new Promise<void>(resolve => {
      resolveRefresh.current = resolve
      startTransition(() => {
        router.refresh()
      })
    })
  }

  useEffect(() => {
    if (isPending) {
      wasPending.current = true
      return
    }
    if (!wasPending.current) return
    wasPending.current = false
    resolveRefresh.current?.()
    resolveRefresh.current = undefined
  }, [isPending])

  return refresh
}
