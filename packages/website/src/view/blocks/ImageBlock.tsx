import {fromModule} from '@alinea/ui'
import css from './ImageBlock.module.scss'
import {ImageBlockSchema} from './ImageBlock.schema'

const styles = fromModule(css)

export function ImageBlock({image}: ImageBlockSchema) {
  return <div className={styles.root()}>image</div>
}
