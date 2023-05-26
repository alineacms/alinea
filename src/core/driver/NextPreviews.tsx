'use client'

import {PREVIEW_COOKIE_NAME} from 'alinea/preview/PreviewConstants'
import {formatPreviewCookies} from 'alinea/preview/PreviewCookie'
import {usePreview} from 'alinea/preview/react'
// @ts-ignore
import {useRouter} from 'next/navigation'

export default function NextPreviews() {
  const router = useRouter()
  const {isPreviewing} = usePreview({
    async preview(entry) {
      for (const cookie of formatPreviewCookies(PREVIEW_COOKIE_NAME, entry)) {
        document.cookie = cookie
      }
      router.refresh()
    }
  })
  return <div>Preview: {isPreviewing ? 'in iframe' : 'no'}</div>
}
