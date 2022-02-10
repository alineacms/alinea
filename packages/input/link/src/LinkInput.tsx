import {InputLabel, InputState, useInput} from '@alinea/editor'
import {fromModule} from '@alinea/ui'
import {LinkField} from './LinkField'
import css from './LinkInput.module.scss'

const styles = fromModule(css)

export type LinkInputProps = {
  path: InputState<string>
  field: LinkField
}

export function LinkInput({path, field}: LinkInputProps) {
  const [value, setValue] = useInput(path)
  const {optional, help} = field.options
  return (
    <div className={styles.root()}>
      <InputLabel label={field.label} help={help} optional={optional}>
        pick link
      </InputLabel>
    </div>
  )
}
