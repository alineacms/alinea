'use client'

import {usePreview} from 'alinea/preview/react'
import {usePathname, useRouter} from 'next/navigation.js'
import {useEffect} from 'react'
import {registerPreviewWidget} from '../preview/widget.js'
import {setPreviewCookies} from './AlineaCookies.js'

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
  const pathname = usePathname()
  const adminUrl = new URL(dashboardUrl, location.origin)
  const entryParams = new URLSearchParams({url: pathname})
  if (workspace) entryParams.set('workspace', workspace)
  if (root) entryParams.set('root', root)
  const editUrl = new URL(`#/edit?${entryParams}`, adminUrl)
  const router = useRouter()
  const {isPreviewing} = usePreview({
    async preview({update}) {
      if (!update) return
      setPreviewCookies(update)
      router.refresh()
    }
  })
  console.log(isPreviewing)
  useEffect(() => {
    if (widget && isPreviewing) registerPreviewWidget()
  }, [isPreviewing])
  if (!widget || !isPreviewing) return null
  return (
    <alinea-preview adminUrl={String(adminUrl)} editUrl={String(editUrl)} />
  )
}
