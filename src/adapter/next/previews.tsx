'use client'

import {setPreviewCookies} from 'alinea/preview/PreviewCookies'
import {usePreview} from 'alinea/preview/react'
import {registerPreviewWidget} from 'alinea/preview/widget'
import {usePathname, useRouter} from 'next/navigation.js'
import {useEffect, useState} from 'react'

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
  const [previewDisabled, setPreviewDisabled] = useState(false)
  const pathname = usePathname()
  const adminUrl = new URL(dashboardUrl, location.origin)
  const entryParams = new URLSearchParams({url: pathname})
  if (workspace) entryParams.set('workspace', workspace)
  if (root) entryParams.set('root', root)
  const editUrl = new URL(`#/edit?${entryParams}`, adminUrl)
  const router = useRouter()
  const {isPreviewing} = usePreview({
    async preview(update) {
      if (!update) return
      const success = await setPreviewCookies(update.payload)
      if (success) router.refresh()
      setPreviewDisabled(!success)
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
        isPreviewing ? (previewDisabled ? 'warning' : 'connected') : undefined
      }
    />
  )
}
