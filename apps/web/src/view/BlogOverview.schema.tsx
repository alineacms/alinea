import {type} from '@alinea/core'
import {path} from '@alinea/input.path'
import {text} from '@alinea/input.text'

export const BlogOverviewSchema = type('Blog overview', {
  title: text('Title', {width: 0.5}),
  path: path('Path', {width: 0.5})
}).configure({isContainer: true, contains: ['BlogPost']})
