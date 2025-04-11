import {Field} from 'alinea/core/Field'
import {Type} from 'alinea/core/Type'
import {entries} from 'alinea/core/util/Objects'
import {type Atom, type Getter, atom} from 'jotai'
import {type PropsWithChildren, createContext, useContext, useMemo} from 'react'
import * as Y from 'yjs'

import {DOC_KEY, applyEntryData} from 'alinea/core/Doc'
import {Section} from 'alinea/core/Section'
import {
  type FieldGetter,
  type ValueTracker,
  optionTrackerOf,
  valueTrackerOf
} from 'alinea/core/Tracker'
import {unwrap} from 'jotai/utils'

export interface FieldInfo<
  StoredValue = any,
  QueryValue = any,
  Mutator = any,
  Options = any
> {
  key: string
  field: Field<StoredValue, QueryValue, Mutator, Options>
  value: Atom<StoredValue>
  options: Atom<Options | Promise<Options>>
  error: Atom<boolean | string | undefined>
  mutator: Mutator
}

export class FormAtoms<T = any> {
  private fields = new Map<symbol, FieldInfo>()

  private errorMap = atom(
    new Map<string, {field: Field; error: boolean | string}>()
  )

  errors = atom(
    get => get(this.errorMap),
    (
      get,
      set,
      path: string,
      field: Field,
      error: boolean | string | undefined
    ) => {
      const current = get(this.errorMap)
      if (!error && !current.has(path)) return
      const errors = new Map(current)
      if (error) errors.set(path, {field, error})
      else errors.delete(path)
      set(this.errorMap, errors)
      if (this.options.parent)
        set(this.options.parent.errors, path, field, error)
    }
  )

  hasErrors = atom(get => get(this.errorMap).size > 0)

  constructor(
    public type: Type<T>,
    public container: Y.Map<any>,
    public path = '',
    public options: {
      parent?: FormAtoms
      readOnly?: boolean
    } = {}
  ) {
    const readOnly = options.readOnly
    const forcedOptions = typeof readOnly === 'boolean' ? {readOnly} : {}
    container.doc!.transact(() => {
      for (const section of Type.sections(type)) {
        for (const [key, field] of entries(Section.fields(section))) {
          const ref = Field.ref(field)
          const shape = Field.shape(field)
          const defaultOptions = {...Field.options(field), ...forcedOptions}
          const optionsTracker = optionTrackerOf(field)
          shape.init(container, key)
          const mutator = shape.mutator(container, key)
          const options = optionsTracker
            ? unwrap(
                atom(get => {
                  const tracked = optionsTracker(this.getter(get))
                  if (tracked instanceof Promise)
                    return tracked.then(partial => {
                      return {...defaultOptions, ...partial, ...forcedOptions}
                    })
                  return {...defaultOptions, ...tracked, ...forcedOptions}
                }),
                prev => prev ?? defaultOptions
              )
            : atom(defaultOptions)
          const valueTracker = valueTrackerOf(field)
          const value = this.valueAtom(field, key, valueTracker)
          const error = atom(get => {
            const {validate, required} = get(options)
            if (validate) {
              const res = validate(get(value))
              if (typeof res === 'boolean') return !res
              return res
            }if (required) {
              const current = get(value)
              if (current === undefined || current === null) return true
              if (typeof current === 'string' && current === '') return true
              if (Array.isArray(current) && current.length === 0) return true
            }
          })
          this.fields.set(ref, {
            key,
            field,
            value,
            mutator,
            error,
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
    const info = this.fieldInfo(field)
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
      if (tracker && next !== current) shape.applyY(next, this.container, key)
      return next
    })
  }

  fieldByKey(key: string): Field {
    for (const info of this.fields.values())
      if (info.key === key) return info.field
    throw new Error(`Field not found: "${key}"`)
  }

  keyOf(field: Field) {
    return this.fieldInfo(field).key
  }

  fieldInfo<StoredValue, QueryValue, Mutator, Options>(
    field: Field<StoredValue, QueryValue, Mutator, Options>
  ): FieldInfo<StoredValue, QueryValue, Mutator, Options> {
    const res = this.fields.get(Field.ref(field))
    const label = Field.label(field)
    if (!res) {
      if (this.options.parent) return this.options.parent.fieldInfo(field)
      throw new Error(`Field not found: ${label}`)
    }
    return res as FieldInfo<StoredValue, QueryValue, Mutator, Options>
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
    return new FormAtoms(type, doc.getMap(DOC_KEY))
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
  readOnly?: boolean
}

export function FormRow({
  children,
  field,
  type,
  rowId,
  readOnly
}: PropsWithChildren<FormRowProps>) {
  const form = useFormContext()
  const rowForm = useMemo(() => {
    const key = form.keyOf(field)
    const inner = form.container.get(key)
    const row = rowId ? inner.get(rowId) : inner
    const path = `${form.path}.${key}${rowId ? `[${rowId}]` : ''}`
    return new FormAtoms(type, row, path, {
      readOnly,
      parent: form
    })
  }, [form, rowId, readOnly])
  return <FormProvider form={rowForm}>{children}</FormProvider>
}
