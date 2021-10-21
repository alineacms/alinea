import {Channel, InputPath, inputPath} from '@alinea/core'
import {fromModule} from '@alinea/ui'
import css from './Fields.module.scss'
import {Input} from './Input'

const styles = fromModule(css)

type EntryEditFieldsProps = {
  path?: InputPath<any>
  channel: Channel
}

export function Fields({path, channel}: EntryEditFieldsProps) {
  const fields = Array.from(channel)
  return (
    <div className={styles.root()}>
      {fields.map(([name, field]) => {
        return (
          <Input
            key={name}
            path={inputPath(field.type, (path?.location || []).concat(name))}
            field={field}
          />
        )
      })}
    </div>
  )
}
