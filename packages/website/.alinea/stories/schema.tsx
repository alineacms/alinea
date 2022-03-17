import {schema, type} from '@alinea/core'
import {text} from '@alinea/input.text'

export const storiesSchema = schema({
  StoryDir: type('StoryDir', {
    title: text('Title')
  }).configure({isContainer: true, contains: ['StoryDir', 'Story']}),
  Story: type('Story', {
    title: text('Title')
  })
})
