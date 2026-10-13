import type {FieldOptions} from '#/core/Field.js'
import {RecordField} from '#/core/field/RecordField.js'
import {type Section, type SectionData, section} from '#/core/Section.js'
import {Type, type} from '#/core/Type.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import {type ImageField, type ImageLink, image} from '#/field/link.js'
import {type ObjectField, object} from '#/field/object.js'
import {type TextField, text} from '#/field/text.js'
import type {MetadataAlias} from './MetadataAliases.js'
import {
  beforeSaveWithAudit,
  type MetadataAuditUser,
  type MetadataDetailsFields,
  metadataDetailsType,
  withAudit
} from './MetadataAudit.js'

export {
  aliases,
  type AliasesField,
  type MetadataAlias
} from './MetadataAliases.js'
export * from './MetadataAudit.js'

export interface MetadataSeoFields {
  title: TextField
  description: TextField
  openGraph: ObjectField<{
    image: ImageField
    title: TextField
    description: TextField
  }>
}

export interface MetadataFields
  extends MetadataSeoFields, MetadataDetailsFields {}

export interface Metadata {
  title: string
  description: string
  aliases: Array<MetadataAlias>
  openGraph: {
    image: ImageLink
    title: string
    description: string
  }
  createdAt: number | null
  createdBy: MetadataAuditUser
  updatedAt: number | null
  updatedBy: MetadataAuditUser
}

export interface MetadataOptions extends FieldOptions<Metadata> {
  fields: Type<MetadataFields>
  seo: Type<MetadataSeoFields>
  details: Type<MetadataDetailsFields>
  /** The details and previews are rendered by the separate
   * `metadataDetails` and `metadataPreviews` sections */
  sections?: boolean
}

export interface MetadataConfig {
  /** Leave the details and previews out of the field view, render them
   * with `metadataDetails(field)` and `metadataPreviews()` instead */
  sections?: boolean
}

export class MetadataField extends RecordField<Metadata, MetadataOptions> {}

export interface MetadataField extends MetadataFields {}

export function metadata(
  label = 'Metadata',
  {sections}: MetadataConfig = {}
): MetadataField {
  const seo = type('SEO', {
    fields: {
      title: text('Title'),
      description: text('Description', {
        multiline: true,
        help: 'Optimal length: 120–160 characters'
      }),
      openGraph: object('Open Graph', {
        fields: {
          image: image('Image', {
            help: 'Recommended size: 1200x630 pixels'
          }),
          title: text('Title', {help: 'If empty, default title'}),
          description: text('Description', {
            multiline: true,
            help: 'If empty, default description'
          })
        }
      })
    }
  })
  const details = metadataDetailsType()
  const {title, description, openGraph} = seo
  const {createdAt, createdBy, updatedAt, updatedBy} = details
  const fields = type('Fields', {
    fields: {
      title,
      description,
      aliases: details.aliases,
      openGraph,
      createdAt,
      createdBy,
      updatedAt,
      updatedBy
    }
  })
  const result = new MetadataField(fields, {
    options: {
      label,
      fields,
      seo,
      details,
      sections
    },
    defaultValue() {
      return Type.initialValue(fields) as unknown as Metadata
    },
    view: viewKeys.MetadataInput,
    beforeSave(context) {
      return beforeSaveWithAudit(fields, context) as unknown as Metadata
    }
  })
  return withAudit(Object.assign(result, fields))
}

export class MetadataDetailsSection implements SectionData {
  view = viewKeys.MetadataDetailsView
  definition = {}
  fields = {}
  sections = []
  constructor(public field: MetadataField) {}
}

/** Renders the created/updated details and aliases of a metadata field
 * created with `sections: true` */
export function metadataDetails(field: MetadataField): Section {
  return section(new MetadataDetailsSection(field))
}

export class MetadataPreviewsSection implements SectionData {
  view = viewKeys.MetadataPreviewsView
  definition = {}
  fields = {}
  sections = []
}

/** Renders the search and Open Graph previews of the entry, for a metadata
 * field created with `sections: true` */
export function metadataPreviews(): Section {
  return section(new MetadataPreviewsSection())
}
