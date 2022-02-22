import {Media, type, view} from '@alinea/core'
import {text} from '@alinea/input.text'
import {Collection} from '@alinea/store/Collection'
import {Chip, HStack, TextLabel} from '@alinea/ui'
import {MdOutlinePermMedia} from 'react-icons/md'
import {useWorkspace} from '../hook/UseWorkspace'
import {MediaExplorer} from '../view/MediaExplorer'

function fileSummarySelect(File: Collection<Media.File>) {
  return {
    id: File.id,
    type: File.type,
    workspace: File.workspace,
    root: File.root,
    title: File.title,
    extension: File.extension,
    size: File.size,
    preview: File.preview,
    averageColor: File.averageColor
  }
}

export const FileSummaryRow = view(
  fileSummarySelect,
  function FileSummaryRow(file) {
    const {schema} = useWorkspace()
    const type = schema.type(file.type)!
    return (
      <HStack center gap={10}>
        <TextLabel label={file.title} />
        <Chip>
          <TextLabel label={type.label} />
        </Chip>
      </HStack>
    )
  }
)

export const MediaSchema = {
  MediaLibrary: type('Media directory', {
    title: text('Title')
  }).configure({
    isContainer: true,
    contains: ['MediaLibrary'],
    view: MediaExplorer,
    icon: MdOutlinePermMedia
  }),
  File: type('File', {
    title: text('Title')
    // Todo: typed this as any until we introduce localisation
  }).configure<any>({isHidden: true, summaryRow: FileSummaryRow})
}
