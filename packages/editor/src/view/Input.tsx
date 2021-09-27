import {Field, InputPath} from '@alinea/core'
import {fromModule} from '@alinea/ui/styler'
import css from './Input.module.scss'

const styles = fromModule(css)

function MissingView() {
  return <div>Missing view</div>
}

export type InputProps<T> = {
  path: InputPath<T>
  field: Field<T>
}

export function Input<T>({path, field}: InputProps<T>) {
  const View = field.view
  if (!View) return <MissingView />
  return (
    <div className={styles.root()}>
      <View path={path} field={field} />
    </div>
  )
}
