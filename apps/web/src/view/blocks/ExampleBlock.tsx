import {Page} from '@alinea/content'
import {fromModule} from '@alinea/ui'
import css from './ExampleBlock.module.scss'

const styles = fromModule(css)

export function ExampleBlock({code}: Page.ExampleBlock) {
  return (
    <div>
      <iframe
        className={styles.root.iframe()}
        src={`/playground?view=preview#code/${code}`}
      />
    </div>
  )
}
