import {fromModule} from '@alinea/ui'
import {decode} from 'blurhash'
import Image from 'next/image'
import {useMemo} from 'react'
import css from './ImageBlock.module.scss'
import {ImageBlockProps} from './ImageBlock.query'

const styles = fromModule(css)

function useBlurData(
  blurHash: string,
  width: number = 160,
  height: number = 120,
  punch?: number
) {
  return useMemo(() => {
    if (!process.browser) return undefined
    const pixels = decode(blurHash, width, height, punch)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.createImageData(width, height)
    imageData.data.set(pixels)
    ctx.putImageData(imageData, 0, 0)
    const blurDataUrl = canvas.toDataURL()
    return blurDataUrl
  }, [blurHash, width, height, punch])
}

export function ImageBlock({image}: ImageBlockProps) {
  const [link] = image
  if (!link) return null
  const blurDataURL = useBlurData(link.blurHash!)
  return (
    <div className={styles.root()}>
      <Image
        src={link.src}
        layout="fill"
        blurDataURL={blurDataURL}
        alt={String(link.alt)}
      />
    </div>
  )
}
