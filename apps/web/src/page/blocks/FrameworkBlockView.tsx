import {supportedFrameworks} from '@/layout/nav/Frameworks'
import {FrameworkBlock} from '@/schema/blocks/FrameworkBlock'
import {Infer} from 'alinea'
import {fromModule} from 'alinea/ui'
import {RenderSelectedFramework} from './FrameworkBlockView.client'
import css from './FrameworkBlockView.module.scss'
import {TextView} from './TextBlockView'

const styles = fromModule(css)

export function FrameworkBlockView(blocks: Infer<typeof FrameworkBlock>) {
  return (
    <div className={styles.root()}>
      <RenderSelectedFramework
        options={supportedFrameworks.map(framework => {
          const body = blocks[framework.name]
          return [framework.name, <TextView key={framework.name} text={body} />]
        })}
      />
    </div>
  )
}
