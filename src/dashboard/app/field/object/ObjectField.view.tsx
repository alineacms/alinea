import {ObjectField} from '#/field/object.js'
import {styler} from '@alinea/styler'
import {
  ReactiveNode,
  useFieldError,
  useFieldNode,
  useFieldOptions
} from '../../../store.js'
import {NodeEditor} from '../../Editor.js'
import {Surface, SurfaceContent, SurfaceHeader} from '../../ui/Surface.js'
import css from './ObjectFieldView.module.css'

const styles = styler(css)

export interface ObjectFieldViewProps {
  field: ObjectField<object>
}

export function ObjectFieldView({field}: ObjectFieldViewProps) {
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const node = useFieldNode(field)
  return (
    <Surface className={styles.ObjectFieldView()}>
      <SurfaceHeader>
        <strong>{options.label}</strong>
      </SurfaceHeader>
      <SurfaceContent>
        <NodeEditor node={node as ReactiveNode<object>} type={options.fields} />
        {error && <div className={styles.ObjectFieldView.error()}>{error}</div>}
      </SurfaceContent>
    </Surface>
  )
}
