import {MediaExplorer} from 'alinea/dashboard/view/MediaExplorer'
import {PathField} from 'alinea/input/path'
import {TextField} from 'alinea/input/text'
import IcRoundPermMedia from 'alinea/ui/icons/IcRoundPermMedia'
import {Meta} from '../Meta.js'
import {PageSeed} from '../Page.js'
import {Root, root} from '../Root.js'
import {createMediaRoot as createMediaRootConfig} from './MediaRoot.js'

type MediaRoot = Root<{
  media: PageSeed<{
    title: TextField
    path: PathField
  }>
}>

export function createMediaRoot(): MediaRoot {
  return root('Media', {
    media: createMediaRootConfig().media,
    [Meta]: {
      icon: IcRoundPermMedia,
      contains: ['MediaLibrary'],
      view: MediaExplorer
    }
  })
}
