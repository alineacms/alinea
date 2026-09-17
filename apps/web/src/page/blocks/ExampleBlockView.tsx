import {ExampleBlock} from '@/schema/blocks/ExampleBlock'
import styler from '@alinea/styler'
import {Infer} from 'alinea'
import lzstring from 'lz-string'
import css from './ExampleBlockView.module.scss'

const styles = styler(css)

export async function ExampleBlockView({code}: Infer<typeof ExampleBlock>) {
  const hash = lzstring.compressToEncodedURIComponent(code)
  return (
    <div>
      <iframe
        className={styles.root.iframe()}
        src={`/playground?view=preview#code/${hash}`}
      />
    </div>
  )
}
