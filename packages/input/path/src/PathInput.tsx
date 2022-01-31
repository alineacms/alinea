import {createError, isSeparator, slugify} from '@alinea/core'
import {InputLabel, InputPath, useInput} from '@alinea/editor'
import {fromModule} from '@alinea/ui'
import {useState} from 'react'
import {PathField} from './PathField'
import css from './PathInput.module.scss'

const styles = fromModule(css)

export type PathInputProps = {
  path: InputPath<string>
  field: PathField
}

export function PathInput({path, field}: PathInputProps) {
  if (!(path instanceof InputPath.EntryProperty))
    throw createError('Path must be an Entry property')
  const {from = 'title', help, optional} = field.options
  const [source = ''] = useInput<string>(
    new InputPath.EntryProperty(path.location.slice(0, -1).concat(from))
  )
  const [value = slugify(source), setValue] = useInput(path)
  const [endsWithSeparator, setEndsWithSeparator] = useState(false)
  const inputValue = (value || '') + (endsWithSeparator ? '-' : '')
  return (
    <div className={styles.root()}>
      <InputLabel label={field.label} help={help} optional={optional}>
        <input
          className={styles.root.input()}
          type="path"
          value={inputValue}
          onChange={e => {
            const value = e.currentTarget.value
            setEndsWithSeparator(isSeparator(value.charAt(value.length - 1)))
            setValue(slugify(value))
          }}
        />
      </InputLabel>
    </div>
  )
}
