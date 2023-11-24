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

const MAX_CHUNKS = 5

export default function NextPreviews() {
  const router = useRouter()
  const {isPreviewing} = usePreview({
    async preview({entryId, phase, update}) {
      const chunks = chunkCookieValue(PREVIEW_UPDATE_NAME, update)

      // Todo: if we reached the limit show the user a modal or indication in
      // the UI that previewing will be temporarily disabled until the changes
      // are saved or published
      if (chunks.length > MAX_CHUNKS) {
        console.warn('Too many chunks, previewing will be disabled')
        return
      }

      const now = Date.now()
      const expiry = new Date(now + 10_000)
      document.cookie = `${PREVIEW_ENTRYID_NAME}=${entryId};expires=${expiry.toUTCString()};path=/`
      document.cookie = `${PREVIEW_PHASE_NAME}=${phase};expires=${expiry.toUTCString()};path=/`
      for (const {name, value} of chunks) {
        document.cookie = `${name}=${value};expires=${expiry.toUTCString()};path=/`
      }
      router.refresh()
    }
  })
  return null
}
