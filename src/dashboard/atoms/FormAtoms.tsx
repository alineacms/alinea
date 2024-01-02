import {
  Field,
  FieldGetter,
  FieldOptions,
  ROOT_KEY,
  Section,
  Type,
  applyEntryData,
  track
} from 'alinea/core'
import {entries} from 'alinea/core/util/Objects'
import {Atom, Getter, atom} from 'jotai'
import {PropsWithChildren, createContext, useContext, useMemo} from 'react'
import * as Y from 'yjs'

export interface FieldInfo<
  Value = any,
  Mutator = any,
  Options extends FieldOptions = FieldOptions
> {
  key: string
  value: Atom<Value>
  options: Atom<Options | Promise<Options>>
  mutator: Mutator
}

export class FormAtoms<T = any> {
  fieldInfo = new Map<symbol, FieldInfo>()

  constructor(
    public type: Type<T>,
    public container: Y.Map<any>,
    private options: {
      readOnly: boolean
    } = {readOnly: false}
  ) {
    for (const section of Type.sections(type)) {
      for (const [key, field] of entries(Section.fields(section))) {
        const ref = Field.ref(field)
        const shape = Field.shape(field)
        const defaultOptions = Field.options(field)
        const optionsTracker = track.optionTrackerOf(field)
        shape.init(container, key)
        const mutator = shape.mutator(container, key, false)
        const options = optionsTracker
          ? atom(get => optionsTracker(this.getter(get)))
          : atom(defaultOptions)
        const value = this.valueAtom(field, key)
        this.fieldInfo.set(ref, {
          key,
          value,
          mutator,
          options
        })
      }
    }
  }

  data(): Type.Infer<T> {
    return Type.shape(this.type).fromY(this.container) as Type.Infer<T>
  }

  getter: (get: Getter) => FieldGetter = get => field => {
    const info = this.fieldInfo.get(Field.ref(field))
    if (!info) throw new Error(`Field not found: ${Field.label(field)}`)
    return get(info.value)
  }

  private valueAtom(field: Field, key: string) {
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
      return shape.fromY(this.container.get(key))
    })
  }

  keyOf(field: Field) {
    const res = this.fieldInfo.get(Field.ref(field))
    const label = Field.label(field)
    if (!res) throw new Error(`Field not found: ${label}`)
    return res.key
  }

  atomsOf<Value, Mutator, Options extends FieldOptions>(
    field: Field<Value, Mutator, Options>
  ): FieldInfo<Value, Mutator, Options> {
    const res = this.fieldInfo.get(Field.ref(field))
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
  const doc = options.doc ?? new Y.Doc()
  return useMemo(() => {
    if (options.initialValue) {
      applyEntryData(doc, type, {data: options.initialValue} as any)
    }
    return new FormAtoms(type, doc.getMap(ROOT_KEY))
  }, [type, doc])
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
    const row = rowId ? inner.get(rowId) : inner
    return new FormAtoms(type, row)
  }, [form, rowId])
  return <FormProvider form={rowForm}>{children}</FormProvider>
}
