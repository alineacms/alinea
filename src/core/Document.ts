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
  type TabFields,
  Type,
  type TypeConfig,
  type
} from './Type.js'
import {entries, keys, values} from './util/Objects.js'

const documentMarker = Symbol.for('@alinea.Document')

export type Document = {
  title: TextField
  path: PathField
  metadata: MetadataField
}

export type DocumentConfig<Fields, Seo, Details, Tabs = {}> = (
  | TypeConfig<Fields>
  | ContainerTypeConfig<Fields>
) &
  PageTabsConfig<Seo, Details> & {
    /** Tabs after the Details tab, eg. an Analytics tab with a view */
    tabs?: Tabs
  }

export function document<
  Fields extends FieldsDefinition = {},
  Seo extends FieldsDefinition = {},
  Details extends FieldsDefinition = {},
  Tabs extends Record<string, Type> = {}
>(
  label: string,
  {
    fields = {} as Fields,
    seo = {} as Seo,
    details = {} as Details,
    tabs: extraTabs = {} as Tabs,
    ...config
  }: DocumentConfig<Fields, Seo, Details, Tabs>
): Type<Document & Fields & Seo & Details & TabFields<Tabs>> {
  const title = text('Title', {required: true, width: 0.5})
  const path = createPath('Path', {required: true, width: 0.5})
  // Fields may replace the title and path; the other tabs add fields.
  const page = pageTabs(
    {seo, details},
    {title, path, ...fields},
    ...values(extraTabs)
  )
  const fieldsWithMeta: Document & Fields & Seo & Details & TabFields<Tabs> = <
    any
  >tabs(
    tab('Document', {
      icon: IcRoundDescription,
      fields: {title, path, ...fields}
    }),
    page.seo,
    page.details,
    // Custom tabs, eg. an Analytics tab with a view
    ...values(extraTabs)
  )
  return asDocument(type(label, {...config, fields: fieldsWithMeta}))
}

export interface PageTabsConfig<Seo, Details> {
  /** Fields shown in the SEO tab, above the previews */
  seo?: Seo
  /** Fields shown in the Details tab, above the created and updated details */
  details?: Details
}

/**
 * The SEO and Details tabs of an entry that is a page: its metadata with
 * previews, and when it was created and updated. Throws when a field of them
 * is named like one of `fields` or `others`.
 */
export function pageTabs(
  {seo = {}, details = {}}: PageTabsConfig<FieldsDefinition, FieldsDefinition>,
  fields: FieldsDefinition,
  ...others: Array<Type>
): {seo: Type; details: Type} {
  const metadata = createMetadata('Metadata', {sections: true})
  const taken = new Set(['metadata', ...fieldNames(fields)])
  for (const name of [
    ...fieldNames(seo),
    ...fieldNames(details),
    ...others.flatMap(tab => keys(Type.fields(tab)))
  ]) {
    if (taken.has(name)) throw new Error(`Field "${name}" is defined twice`)
    taken.add(name)
  }
  return {
    seo: tab('SEO', {
      icon: IcRoundBolt,
      fields: {metadata, ...seo, ...metadataPreviews()}
    }),
    details: tab('Details', {
      icon: IcRoundInfo,
      fields: {...details, ...metadataDetails(metadata)}
    })
  }
}

/** Mark `type` as a page, so moving or archiving it asks for a redirect */
export function asDocument<T extends Type>(type: T): T {
  return Object.assign(type, {[documentMarker]: true})
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
