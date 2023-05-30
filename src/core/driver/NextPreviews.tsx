'use client'

import {chunkCookieValue} from 'alinea/preview/ChunkCookieValue'
import {
  PREVIEW_ENTRYID_NAME,
  PREVIEW_PHASE_NAME,
  PREVIEW_UPDATE_NAME
} from 'alinea/preview/PreviewConstants'
import {usePreview} from 'alinea/preview/react'
// @ts-ignore
import {useRouter} from 'next/navigation'

export default function NextPreviews() {
  const router = useRouter()
  const {isPreviewing} = usePreview({
    async preview({entryId, phase, update}) {
      document.cookie = `${PREVIEW_ENTRYID_NAME}=${entryId}`
      document.cookie = `${PREVIEW_PHASE_NAME}=${phase}`
      for (const {name, value} of chunkCookieValue(
        PREVIEW_UPDATE_NAME,
        update
      )) {
        document.cookie = `${name}=${value}`
      }
      router.refresh()
    }
  })
  return <div>Preview: {isPreviewing ? 'in iframe' : 'no'}</div>
}
