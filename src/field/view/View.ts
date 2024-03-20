import {Field} from 'alinea/core/Field'
import {SectionData, SectionDefinition, section} from 'alinea/core/Section'
import {ReactNode} from 'react'

export class ViewSection implements SectionData {
  definition: SectionDefinition = {}
  fields: Record<string, Field> = {}
  constructor(public children: ReactNode) {}
}

export function view(children: ReactNode) {
  return section(new ViewSection(children))
}
