import {supportedFrameworks} from '@/layout/nav/Frameworks'
import {FrameworkBlock} from '@/schema/blocks/FrameworkBlock'
import styler from '@alinea/styler'
import {Infer} from 'alinea'
import {RenderSelectedFramework} from './FrameworkBlockView.client'
import css from './FrameworkBlockView.module.scss'
import {TextFieldView} from './TextFieldView'

const styles = styler(css)

export function FrameworkBlockView(blocks: Infer<typeof FrameworkBlock>) {
  return (
    <div className={styles.root()}>
      <RenderSelectedFramework
        options={supportedFrameworks.map(framework => {
          const body = blocks[framework.name]
          return [
            framework.name,
            <TextFieldView key={framework.name} text={body} />
          ]
        })}
      />
    </div>
  )
}
