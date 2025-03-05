'use client'

import {setPreviewCookies} from 'alinea/preview/PreviewCookies'
import {usePreview} from 'alinea/preview/react'
import {registerPreviewWidget} from 'alinea/preview/widget'
import {usePathname, useRouter} from 'next/navigation.js'
import {useEffect, useState, useTransition} from 'react'

export interface NextPreviewsProps {
  dashboardUrl: string
  widget?: boolean
  root?: string
  workspace?: string
}

export default function NextPreviews({
  dashboardUrl,
  widget,
  root,
  workspace
}: NextPreviewsProps) {
  const refresh = useRouterRefresh()
  const [isLoading, setIsLoading] = useState(false)
  const [previewDisabled, setPreviewDisabled] = useState(false)
  const pathname = usePathname()
  const adminUrl = new URL(dashboardUrl, location.origin)
  const entryParams = new URLSearchParams({url: pathname})
  if (workspace) entryParams.set('workspace', workspace)
  if (root) entryParams.set('root', root)
  const editUrl = new URL(`#/edit?${entryParams}`, adminUrl)
  const {isPreviewing} = usePreview({
    async preview(update) {
      if (!update) return
      const success = await setPreviewCookies(update.payload)
      setPreviewDisabled(!success)
      if (!success) return
      setIsLoading(true)
      refresh().then(() => setIsLoading(false))
    }
  })
  useEffect(() => {
    if (widget) registerPreviewWidget()
  }, [widget])
  if (!widget) return null
  return (
    <alinea-preview
      adminUrl={String(adminUrl)}
      editUrl={String(editUrl)}
      livePreview={
        isLoading
          ? 'loading'
          : isPreviewing
          ? previewDisabled
            ? 'warning'
            : 'connected'
          : undefined
      }
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

  const [resolve, setResolve] = useState<((value: unknown) => void) | null>(
    null
  )
  const [isTriggered, setIsTriggered] = useState(false)

  const refresh = () => {
    return new Promise((resolve, reject) => {
      setResolve(() => resolve)
      startTransition(() => {
        router.refresh()
      })
    })
  }

  useEffect(() => {
    if (isTriggered && !isPending) {
      if (resolve) {
        resolve(null)

        setIsTriggered(false)
        setResolve(null)
      }
    }
    if (isPending) {
      setIsTriggered(true)
    }
  }, [isTriggered, isPending, resolve])

  return refresh
}
