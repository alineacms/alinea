import {fromModule} from '@alinea/ui'
import css from './ImageBlock.module.scss'
import {ImageBlockProps} from './ImageBlock.query'

const styles = fromModule(css)

export function ImageBlock({image}: ImageBlockProps) {
  const [link] = image
  // console.log(link)
  return <div className={styles.root()}>image</div>
}
