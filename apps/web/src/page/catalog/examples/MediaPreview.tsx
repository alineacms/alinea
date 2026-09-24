'use client'

import {type FocusPoint, MediaPreview} from 'alinea/components'
import {useState} from 'react'

export function MediaPreviewExample() {
  const [focus, setFocus] = useState<FocusPoint>({x: 0.5, y: 0.6})
  return (
    <MediaPreview
      src="/catalog/oak-dining-chair.jpg"
      averageColor="#b59a7c"
      width={480}
      height={270}
      alt="Oak dining chair"
      focus={focus}
      onFocusChange={setFocus}
      style={{width: 320, height: 180}}
    />
  )
}
