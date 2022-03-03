import {fromModule} from '@alinea/ui'
import css from './ImageBlock.module.scss'
import {ImageBlockSchema} from './ImageBlock.schema'

const styles = fromModule(css)

export function ImageBlock({image}: ImageBlockSchema) {
  const [link] = image
  if (!link || link.type !== 'entry') return null
  return <div className={styles.root()}>image</div>
}
