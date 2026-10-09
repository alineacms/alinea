import {
  IcRoundBolt,
  IcRoundDescription,
  IcRoundInfo
} from '#/dashboard/icons.js'
import {
  type MetadataField,
  metadata as createMetadata,
  metadataDetails,
  metadataPreviews
} from '#/field/metadata.js'
import {type PathField, path as createPath} from '#/field/path.js'
import {tab, tabs} from '#/field/tabs.js'
import {type TextField, text} from '#/field/text.js'
import {Section} from './Section.js'
import {
  type ContainerTypeConfig,
  type FieldsDefinition,
  type Type,
  type TypeConfig,
  type
} from './Type.js'
import {entries, keys} from './util/Objects.js'

const documentMarker = Symbol.for('@alinea.Document')

export type Document = {
  title: TextField
  path: PathField
  metadata: MetadataField
}

export type DocumentConfig<Fields, Seo, Details> = (
  | TypeConfig<Fields>
  | ContainerTypeConfig<Fields>
) & {
  /** Fields shown in the SEO tab, above the previews */
  seo?: Seo
  /** Fields shown in the Details tab, above the created and updated details */
  details?: Details
}

function documentFields() {
  return {
    title: text('Title', {required: true, width: 0.5}),
    path: createPath('Path', {required: true, width: 0.5}),
    metadata: createMetadata('Metadata', {sections: true})
  }
}

export function document<
  Fields extends FieldsDefinition = {},
  Seo extends FieldsDefinition = {},
  Details extends FieldsDefinition = {}
>(
  label: string,
  {
    fields = {} as Fields,
    seo = {} as Seo,
    details = {} as Details,
    ...config
  }: DocumentConfig<Fields, Seo, Details>
): Type<Document & Fields & Seo & Details> {
  const {title, path, metadata} = documentFields()
  // Fields may replace the title and path; the other tabs add fields.
  const taken = new Set([
    ...keys({title, path, metadata}),
    ...fieldNames(fields)
  ])
  for (const name of [...fieldNames(seo), ...fieldNames(details)]) {
    if (taken.has(name)) throw new Error(`Field "${name}" is defined twice`)
    taken.add(name)
  }
  const fieldsWithMeta: Document & Fields & Seo & Details = <any>tabs(
    tab('Document', {
      icon: IcRoundDescription,
      fields: {title, path, ...fields}
    }),
    tab('SEO', {
      icon: IcRoundBolt,
      fields: {metadata, ...seo, ...metadataPreviews()}
    }),
    tab('Details', {
      icon: IcRoundInfo,
      fields: {...details, ...metadataDetails(metadata)}
    })
  )
  const result = type(label, {
    ...config,
    fields: fieldsWithMeta
  })
  return Object.assign(result, {[documentMarker]: true})
}

/** Whether `type` was created with `Config.document` */
export function isDocument(type: Type): boolean {
  return documentMarker in type
}

function fieldNames(definition: FieldsDefinition): Array<string> {
  return entries(definition).flatMap(([name, value]) =>
    Section.isSection(value) ? keys(Section.fields(value)) : [name]
  )
}
