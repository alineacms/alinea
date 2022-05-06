import {schema, Schema, type} from '@alinea/core'
import {list} from '@alinea/input.list'
import {path} from '@alinea/input.path'
import {tab, tabs} from '@alinea/input.tabs'
import {text} from '@alinea/input.text'
import {unsplash} from '@alinea/input.unsplash'
import {IcRoundInsertDriveFile} from '@alinea/ui/icons/IcRoundInsertDriveFile'
import {TextBlockSchema} from './blocks/TextBlock.schema'
import {UnsplashBlockSchema} from './blocks/UnsplashBlock.schema'

export const UnsplashPageSchema = type(
  'Unsplash',
  tabs(
    tab('Unsplashpage', {
      title: text('Title', {
        width: 0.5,
        multiline: true
      }),
      path: path('Path', {width: 0.5}),
      unsplash: unsplash('Unsplash', {
        multiple: {minimum: 2},
        query: 'dog',
        color: 'purple',
        per_page: 20
      }),
      blocks: list('Blocks', {
        schema: schema({
          TextBlock: TextBlockSchema,
          UnsplashBlock: UnsplashBlockSchema
        })
      })
    }).configure({icon: IcRoundInsertDriveFile})
  )
)

export type UnsplashPageSchema = Schema.TypeOf<typeof UnsplashPageSchema>
