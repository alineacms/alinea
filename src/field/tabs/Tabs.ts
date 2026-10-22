import {Field} from '#/core/Field.js'
import {
  type Section,
  type SectionData,
  type SectionDefinition,
  section
} from '#/core/Section.js'
import {
  type FieldsDefinition,
  Type,
  type,
  type TypeConfig
} from '#/core/Type.js'
import {view} from '#/field/view.js'
import type {ReactNode} from 'react'
import {entries, fromEntries} from '#/core/util/Objects.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'

export class TabsSection implements SectionData {
  view = viewKeys.TabsView
  definition: SectionDefinition
  fields: Record<string, Field>
  sections: Array<Section>
  constructor(public types: Array<Type>) {
    this.definition = fromEntries(types.flatMap(entries))
    this.fields = fromEntries(
      types.flatMap(entries).filter(([key, field]) => Field.isField(field))
    )
    this.sections = types.flatMap(Type.sections)
  }
}

// Source: https://stackoverflow.com/a/77965444
type Cast<From, To> = From extends To ? From : never
type FoldIntoIntersection<
  T extends readonly {}[],
  Acc extends {} = {}
> = T extends readonly [infer H, ...infer HS]
  ? FoldIntoIntersection<Cast<HS, readonly {}[]>, Acc & H>
  : Acc

/** Create tabs */
export function tabs<const Types extends Array<Type>>(
  ...types: Types
): FoldIntoIntersection<Types> {
  return section(new TabsSection(types))
}

export interface TabOptions<Fields> extends Omit<
  TypeConfig<Fields>,
  'fields' | 'contains' | 'settings' | 'tabs' | 'view'
> {
  fields?: Fields
  /**
   * A view shown in the tab, after its fields: the path of a component, as
   * with `Field.view`, or an element
   */
  view?: string | ReactNode
}

/** Create a tab, with fields or a view or both */
export function tab<Fields extends FieldsDefinition = {}>(
  label: string,
  {fields = {} as Fields, view: tabView, ...config}: TabOptions<Fields>
): Type<Fields> {
  return type(label, {
    ...config,
    fields: (tabView === undefined
      ? fields
      : {...fields, ...view(tabView)}) as Fields
  })
}
