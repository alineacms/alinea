import {Channel, inputPath} from '@alinea/core'
import {fromModule} from '@alinea/ui'
import css from './Fields.module.scss'
import {Input} from './Input'

const styles = fromModule(css)

type EntryEditFieldsProps = {
  path?: Array<string | number>
  channel: Channel
}

export function Fields({path = [], channel}: EntryEditFieldsProps) {
  const fields = Channel.fields(channel)
  return (
    <div className={styles.root()}>
      {fields.map(([name, field]) => {
        return (
          <Input key={name} path={inputPath(path.concat(name))} field={field} />
        )
      })}
    </div>
  )
}
