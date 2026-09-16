import {Field} from '#/core/Field.js'
import {
  type Section,
  type SectionData,
  type SectionDefinition,
  section
} from '#/core/Section.js'
import {Type, type, type FieldsDefinition} from '#/core/Type.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'

export interface DisclosureConfig<Fields extends FieldsDefinition> {
  fields: Fields
  initiallyExpanded?: boolean
}

export class DisclosureSection implements SectionData {
  view = viewKeys.DisclosureView
  definition: SectionDefinition
  fields: Record<string, Field>
  sections: Array<Section>

  constructor(
    public label: string,
    fields: FieldsDefinition,
    public initiallyExpanded: boolean
  ) {
    const disclosureType = type(label, {fields})
    this.definition = fields
    this.fields = Type.fields(disclosureType)
    this.sections = Type.sections(disclosureType)
  }
}

/** Group fields in a presentational disclosure without changing storage. */
export function disclosure<const Fields extends FieldsDefinition>(
  label: string,
  {fields, initiallyExpanded = false}: DisclosureConfig<Fields>
): Fields {
  return section(
    new DisclosureSection(label, fields, initiallyExpanded)
  ) as Fields
}
