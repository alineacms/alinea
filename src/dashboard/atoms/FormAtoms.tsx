import {
  Field,
  FieldGetter,
  FieldOptions,
  ROOT_KEY,
  Section,
  Type,
  ValueTracker,
  applyEntryData,
  optionTrackerOf,
  valueTrackerOf
} from 'alinea/core'
import {entries} from 'alinea/core/util/Objects'
import {Atom, Getter, atom} from 'jotai'
import {PropsWithChildren, createContext, useContext, useMemo} from 'react'
import * as Y from 'yjs'

import {unwrap} from 'jotai/utils'

export interface FieldInfo<
  Value = any,
  Mutator = any,
  Options extends FieldOptions<Value> = FieldOptions<Value>
> {
  key: string
  field: Field<Value, Mutator, Options>
  value: Atom<Value>
  options: Atom<Options | Promise<Options>>
  mutator: Mutator
}

export class FormAtoms<T = any> {
  private fields = new Map<symbol, FieldInfo>()

  constructor(
    public type: Type<T>,
    public container: Y.Map<any>,
    private options: {readOnly: boolean} = {readOnly: false}
  ) {
    container.doc!.transact(() => {
      for (const section of Type.sections(type)) {
        for (const [key, field] of entries(Section.fields(section))) {
          const ref = Field.ref(field)
          const shape = Field.shape(field)
          const defaultOptions = Field.options(field)
          const optionsTracker = optionTrackerOf(field)
          shape.init(container, key)
          const mutator = shape.mutator(container, key, false)
          const options = optionsTracker
            ? unwrap(
                atom(get => {
                  const tracked = optionsTracker(this.getter(get))
                  if (tracked instanceof Promise)
                    return tracked.then(partial => {
                      return {...defaultOptions, ...partial}
                    })
                  return {...defaultOptions, ...tracked}
                }),
                prev => prev ?? defaultOptions
              )
            : atom(defaultOptions)
          const valueTracker = valueTrackerOf(field)
          const value = this.valueAtom(field, key, valueTracker)
          this.fields.set(ref, {
            key,
            field,
            value,
            mutator,
            options
          })
        }
      }
    }, 'self')
  }

  data(): Type.Infer<T> {
    return Type.shape(this.type).fromY(this.container) as Type.Infer<T>
  }

  private getter: (get: Getter) => FieldGetter = get => field => {
    const info = this.fields.get(Field.ref(field))
    if (!info) throw new Error(`Field not found: ${Field.label(field)}`)
    return get(info.value)
  }

  private valueAtom(
    field: Field,
    key: string,
    tracker: ValueTracker | undefined
  ) {
    const shape = Field.shape(field)
    const revision = atom(0)
    revision.onMount = setAtom => {
      const onChange = () => setAtom(x => x + 1)
      const watch = shape.watch(this.container, key)
      onChange()
      return watch(onChange)
    }
    return atom(g => {
      g(revision)
      const current = shape.fromY(this.container.get(key))
      const next = tracker ? tracker(this.getter(g)) : current
      // Todo: we shouldn't mutate here, this should run in a pass after
      if (next !== current) shape.applyY(next, this.container, key)
      return next
    })
  }

  fieldByKey(key: string): Field {
    for (const info of this.fields.values())
      if (info.key === key) return info.field
    throw new Error(`Field not found: "${key}"`)
  }

  keyOf(field: Field) {
    const res = this.fields.get(Field.ref(field))
    const label = Field.label(field)
    if (!res) throw new Error(`Field not found: ${label}`)
    return res.key
  }

  fieldInfo<Value, Mutator, Options extends FieldOptions<Value>>(
    field: Field<Value, Mutator, Options>
  ): FieldInfo<Value, Mutator, Options> {
    const res = this.fields.get(Field.ref(field))
    const label = Field.label(field)
    if (!res) throw new Error(`Field not found: ${label}`)
    return res as FieldInfo<Value, Mutator, Options>
  }
}

const formAtomsContext = createContext<FormAtoms | undefined>(undefined)

export interface UseFormOptions<T> {
  doc?: Y.Doc
  initialValue?: Partial<Type.Infer<T>>
}

export function useForm<T>(
  type: Type<T>,
  options: UseFormOptions<T> = {}
): FormAtoms<T> {
  return useMemo(() => {
    const doc = options.doc ?? new Y.Doc()
    if (options.initialValue) {
      applyEntryData(doc, type, {data: options.initialValue} as any)
    }
    return new FormAtoms(type, doc.getMap(ROOT_KEY))
  }, [type, options.doc])
}

export function useFormContext() {
  const formAtoms = useContext(formAtomsContext)
  if (!formAtoms) throw new Error('FormAtoms is not provided')
  return formAtoms
}

export interface FieldAtomsProviderProps {
  form: FormAtoms
}

export function FormProvider({
  children,
  form
}: PropsWithChildren<FieldAtomsProviderProps>) {
  return (
    <formAtomsContext.Provider value={form}>
      {children}
    </formAtomsContext.Provider>
  )
}

export interface FormRowProps {
  field: Field
  rowId?: string
  type: Type
}

export function FormRow({
  children,
  field,
  type,
  rowId
}: PropsWithChildren<FormRowProps>) {
  const form = useFormContext()
  const rowForm = useMemo(() => {
    const key = form.keyOf(field)
    const inner = form.container.get(key)
    if (rowId) {
      if (!inner.has(rowId)) inner.set(rowId, new Y.Map())
    }
    const row = rowId ? inner.get(rowId) : inner
    return new FormAtoms(type, row)
  }, [form, rowId])
  return <FormProvider form={rowForm}>{children}</FormProvider>
}
