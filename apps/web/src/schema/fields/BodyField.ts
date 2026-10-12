import {Field} from 'alinea'
import {ChapterLinkBlock} from '../blocks/ChapterLinkBlock'
import {CodeBlock} from '../blocks/CodeBlock'
import {CodeVariantsBlock} from '../blocks/CodeVariantsBlock'
import {ComponentCatalogBlock} from '../blocks/ComponentCatalogBlock'
import {ComponentExampleBlock} from '../blocks/ComponentExampleBlock'
import {ComponentPropsBlock} from '../blocks/ComponentPropsBlock'
import {CopyPromptBlock} from '../blocks/CopyPromptBlock'
import {DiagramBlock} from '../blocks/DiagramBlock'
import {ExampleBlock} from '../blocks/ExampleBlock'
import {FieldCatalogBlock} from '../blocks/FieldCatalogBlock'
import {ImageBlock} from '../blocks/ImageBlock'
import {NoticeBlock} from '../blocks/NoticeBlock'

export const bodyField = () =>
  Field.richText('Body', {
    searchable: true,
    schema: {
      CodeBlock,
      CodeVariantsBlock,
      ImageBlock,
      DiagramBlock,
      NoticeBlock,
      ChapterLinkBlock,
      ExampleBlock,
      CopyPromptBlock,
      FieldCatalogBlock,
      ComponentCatalogBlock,
      ComponentExampleBlock,
      ComponentPropsBlock
    }
  })
