import {createId, inputPath, InputPath, Schema} from '@alinea/core'
import {Fields, Label, useInput} from '@alinea/editor'
import {fromModule, IconButton, TextLabel} from '@alinea/ui'
import {Create} from '@alinea/ui/Create'
import {HStack, VStack} from '@alinea/ui/Stack'
import {generateKeyBetween} from 'fractional-indexing'
import {MdDelete} from 'react-icons/md'
import {ListField} from './ListField'
import css from './ListInput.module.scss'

const styles = fromModule(css)

export type ListRow = {
  $id: string
  $index: string
  $channel: string
}

type ListInputRow<T extends ListRow> = {
  row: T
  path: InputPath<T>
  field: ListField<T>
  onDelete: () => void
}

function ListInputRow<T extends ListRow>({
  row,
  field,
  path,
  onDelete
}: ListInputRow<T>) {
  const channel = Schema.getChannel(field.options.schema, row.$channel)
  if (!channel) return null
  return (
    <div className={styles.row()}>
      <HStack gap={10}>
        <div style={{flexGrow: 1}}>
          <Fields channel={channel as any} path={path} />
        </div>
        <IconButton icon={MdDelete} onClick={onDelete} />
      </HStack>
    </div>
  )
}

type ListCreateRowProps<T> = {
  field: ListField<T>
  onCreate: (channel: string) => void
}

function ListCreateRow<T>({field, onCreate}: ListCreateRowProps<T>) {
  const channels = Schema.iterate(field.options.schema)
  return (
    <Create.Root>
      {channels.map(([key, channel]) => {
        return (
          <Create.Button key={key} onClick={() => onCreate(key)}>
            <TextLabel label={channel.label} />
          </Create.Button>
        )
      })}
    </Create.Root>
  )
}

export type ListInputProps<T> = {
  path: InputPath<Array<T>>
  field: ListField<T>
}

export function ListInput<T extends ListRow>({path, field}: ListInputProps<T>) {
  const [rows, input] = useInput(path, field.value)
  const {help} = field.options
  console.log(rows)
  return (
    <Label label={field.label} help={help}>
      <div className={styles.root()}>
        <VStack gap={10}>
          {rows.map((row, i) => {
            return (
              <ListInputRow<T>
                key={row.$id}
                row={row}
                field={field}
                path={inputPath<T>(path.concat(row.$id))}
                onDelete={() => input.delete(row.$id)}
              />
            )
          })}
        </VStack>
      </div>
      <ListCreateRow
        onCreate={(channel: string) => {
          input.push({
            $id: createId(),
            $channel: channel,
            $index: generateKeyBetween(
              rows[rows.length - 1]?.$index || null,
              null
            )
          } as T)
        }}
        field={field}
      />
    </Label>
  )
}
