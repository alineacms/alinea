import {Schema, type} from '@alinea/core'
import {code} from '@alinea/input.code'
import {fromModule, Typo} from '@alinea/ui'
import css from './CodeBlock.module.scss'

const styles = /* @__PURE__ */ fromModule(css)

export const CodeBlock = type('Code', {
  code: code('Code', {inline: true})
})

export type CodeBlock = Schema.TypeOf<typeof CodeBlock>

export function CodeBlockView({code}: CodeBlock) {
  return (
    <div className={styles.root()}>
      <Typo.Monospace>{code}</Typo.Monospace>
    </div>
  )
}
