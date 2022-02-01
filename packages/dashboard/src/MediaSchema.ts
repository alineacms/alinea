import {type} from '@alinea/core'
import {text} from '@alinea/input.text'
import {MdOutlinePermMedia} from 'react-icons/md'
import {MediaExplorer} from './view/MediaExplorer'

export const media = {
  MediaLibrary: type(
    'Media Library',
    {
      title: text('Title')
    },
    {
      isRootType: true,
      isContainer: true,
      contains: ['File'],
      view: MediaExplorer,
      icon: MdOutlinePermMedia
    }
  ),
  File: type('File', {
    title: text('Title')
  })
}
