import {fromModule} from '@alinea/ui'
import css from './ExampleBlock.module.scss'
import {ExampleBlockSchema} from './ExampleBlock.schema'

const styles = fromModule(css)

export function ExampleBlock({code}: ExampleBlockSchema) {
  return (
    <div>
      <iframe
        className={styles.root.iframe()}
        src={`/playground?view=preview#code/${code}`}
      />
    </div>
  )
}
