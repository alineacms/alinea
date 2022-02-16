import {schema, Schema, type} from '@alinea/core'
import {richText} from '@alinea/input.richtext'
import {fromModule} from '@alinea/ui'
import {RichText} from '../layout/RichText'
import {CodeBlock, CodeBlockView} from './CodeBlock'
import css from './TextBlock.module.scss'

const styles = /* @__PURE__ */ fromModule(css)

export const TextBlock = type('Text', {
  text: richText('Text', {
    blocks: schema({
      CodeBlock
    })
  })
})

export type TextBlock = Schema.TypeOf<typeof TextBlock>

export function TextBlockView({text}: TextBlock) {
  return (
    <div className={styles.root()}>
      <RichText doc={text} view={{CodeBlock: CodeBlockView}} />
    </div>
  )
}
