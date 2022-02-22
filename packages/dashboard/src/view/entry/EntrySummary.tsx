import {Entry, view} from '@alinea/core'
import {Collection} from '@alinea/store'
import {Chip, HStack, TextLabel} from '@alinea/ui'
import {useWorkspace} from '../../hook/UseWorkspace'

function entrySummaryQuery(Entry: Collection<Entry>) {
  return {
    id: Entry.id,
    type: Entry.type,
    workspace: Entry.workspace,
    root: Entry.root,
    title: Entry.title
  }
}

export const EntrySummaryRow = view(
  entrySummaryQuery,
  function EntrySummaryRow(entry) {
    const {schema} = useWorkspace()
    const type = schema.type(entry.type)!
    return (
      <HStack center gap={10}>
        <TextLabel label={entry.title} />
        <Chip>
          <TextLabel label={type.label} />
        </Chip>
      </HStack>
    )
  }
)
