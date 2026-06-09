import {Label} from '#/components.js'
import {NodeEditor} from '#/dashboard/app/Editor.js'
import {Surface, SurfaceContent} from '#/dashboard/app/ui/Surface.js'
import {
  useFieldError,
  useFieldNode,
  useFieldOptions
} from '#/dashboard/hooks.js'
import {ReactiveNode} from '#/dashboard/store.js'
import {ObjectField} from '#/field/object.js'
import {styler} from '@alinea/styler'
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
    <Label label={options.label}>
      <Surface variant="muted">
        <SurfaceContent>
          <NodeEditor
            node={node as ReactiveNode<object>}
            type={options.fields}
          />
          {error && (
            <div className={styles.ObjectFieldView.error()}>{error}</div>
          )}
        </SurfaceContent>
      </Surface>
    </Label>
  )
}
