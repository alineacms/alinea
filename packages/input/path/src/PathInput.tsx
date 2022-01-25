import {createError} from '@alinea/core'
import {InputPath, Label, useInput} from '@alinea/editor'
import {fromModule} from '@alinea/ui'
import slug from 'simple-slugify'
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
  const [value = slug.slugify(source), setValue] = useInput(path)
  return (
    <div className={styles.root()}>
      <Label label={field.label} help={help} optional={optional}>
        <input
          className={styles.root.input()}
          type="path"
          value={value || ''}
          onChange={e => setValue(slug.slugify(e.currentTarget.value))}
        />
      </Label>
    </div>
  )
}
