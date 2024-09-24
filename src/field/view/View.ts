import {Field} from 'alinea/core/Field'
import {SectionData, SectionDefinition, section} from 'alinea/core/Section'

export class ViewSection implements SectionData {
  view: string
  definition: SectionDefinition = {}
  fields: Record<string, Field> = {}
  sections = []
  constructor(component: string) {
    this.view = component
  }
}

export function view(component: string) {
  return section(new ViewSection(component))
}
