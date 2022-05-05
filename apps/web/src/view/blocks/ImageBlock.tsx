import { useBlurData } from "@alinea/dashboard/hook/UseBlurData"
import { fromModule } from '@alinea/ui'
import Image from 'next/image'
import css from './ImageBlock.module.scss'
import { ImageBlockProps } from './ImageBlock.query'

const styles = fromModule(css)

export function ImageBlock({image}: ImageBlockProps) {
  const [link] = image
  if (!link) return null
  return (
    <div className={styles.root()}>
      <Image
        src={link.src}
        layout="fill"
        blurDataURL={useBlurData(link.blurHash!)}
        alt={String(link.alt)}
      />
    </div>
  )
}
