import {schema} from '@alinea/core'
import {MediaSchema} from '@alinea/dashboard/schema/MediaSchema.js'
import {DocPageSchema} from '../../src/view/DocPage.schema'
import {DocsPageSchema} from '../../src/view/DocsPage.schema'
import {HomePageSchema} from '../../src/view/HomePage.schema'

export const webSchema = schema({
  ...MediaSchema,
  Home: HomePageSchema,
  Docs: DocsPageSchema,
  Doc: DocPageSchema
})
