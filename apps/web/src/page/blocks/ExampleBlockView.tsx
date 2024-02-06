import {ExampleBlock} from '@/schema/blocks/ExampleBlock'
import alinea from 'alinea'
import {fromModule} from 'alinea/ui'
import lzstring from 'lz-string'
import css from './ExampleBlockView.module.scss'

const styles = fromModule(css)

export async function ExampleBlockView({
  code
}: alinea.infer<typeof ExampleBlock>) {
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
