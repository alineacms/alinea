import type {ListField} from '#/core/field/ListField.js'
import type {ListRow} from '#/core/ListRow.js'
import {type Type, type} from '#/core/Type.js'
import {list} from '#/field/list.js'
import {type TextField, text} from '#/field/text.js'

export interface MetadataAlias extends ListRow {
  url: string
}

export interface MetadataAliasFields {
  url: TextField
}

type MetadataAliasType = Type<MetadataAliasFields>

export type AliasesField = ListField<
  MetadataAlias,
  MetadataAlias,
  {
    label: string
    schema: {alias: MetadataAliasType}
  }
>

export function aliases(label = 'URL aliases'): AliasesField {
  return list(label, {
    schema: {
      alias: type('URL alias', {
        fields: {
          url: text('URL', {
            help: 'A previous URL that should redirect to this entry'
          })
        }
      })
    }
  })
}
