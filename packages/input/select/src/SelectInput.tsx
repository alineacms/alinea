import {InputPath, Label, useInput} from '@alinea/editor'
import {fromModule} from '@alinea/ui'
import {SelectField} from './SelectField'
import css from './SelectInput.module.scss'

const styles = fromModule(css)

export type SelectInputProps = {
  path: InputPath<string | undefined>
  field: SelectField
}

export function SelectInput({path, field}: SelectInputProps) {
  const [value, setValue] = useInput(path)
  const {optional, help} = field.options
  const {items} = field
  return (
    <div className={styles.root()}>
      <Label label={field.label} help={help} optional={optional}>
        <select value={value} onChange={e => setValue(e.target.value)}>
          {Object.entries(items).map(([key, label]) => {
            return (
              <option key={key} value={key}>
                {label}
              </option>
            )
          })}
        </select>
      </Label>
    </div>
  )
}
