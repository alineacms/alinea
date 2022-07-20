import {fromModule} from '@alinea/ui'
import {decode} from 'blurhash'
// import Image from 'next/image'
import {Fragment, useMemo} from 'react'
import {Image} from '../layout/Image'
import css from './ImageBlock.module.scss'
import {ImageBlockSchema} from './ImageBlock.schema'

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

export function ImageBlock({image, container}: ImageBlockSchema) {
  const Wrapper = container || Fragment
  if (!image) return null
  const blurDataURL = useBlurData(image.blurHash!)

  return (
    <div className={styles.root()}>
      <Wrapper>
        <Image
          src={image.src}
          width={image.width}
          height={image.height}
          sizes="100vw"
          blurDataURL={blurDataURL}
          className={styles.root.image()}
        />
      </Wrapper>
    </div>
  )
}
