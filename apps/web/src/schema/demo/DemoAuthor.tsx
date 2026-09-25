import {Config, Field} from 'alinea'
import {IcOutlinePersonOutline} from '@/icons'

export const DemoAuthor = Config.type('Author', {
  icon: IcOutlinePersonOutline,
  fields: {
    title: Field.text('Name', {width: 0.5, required: true}),
    path: Field.path('Path', {width: 0.5}),
    role: Field.text('Role', {width: 0.5}),
    email: Field.text('Email', {width: 0.5}),
    bio: Field.text('Short bio', {multiline: true}),
    ...Field.view('@/schema/demo/DemoAuthorArticles#DemoAuthorArticles')
  }
})
