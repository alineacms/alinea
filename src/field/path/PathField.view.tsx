import {slugify} from '#/core/util/Slugs.js'
import {
  useEditor,
  useField,
  useFieldError,
  useFieldOptions,
  useOptionalEntryAtoms,
  useSiblingFieldValue
} from '#/dashboard/hooks.js'
import type {PathField} from '#/field/path.js'
import {SlugField} from '#/field/path/SlugField.js'
import {atom, useAtomValueRaw} from 'jotai'
import {memo, useEffect, useRef} from 'react'

const notUntranslated = atom(false)

export interface PathFieldViewProps {
  field: PathField
}

export const PathFieldView = memo(function PathFieldView({
  field
}: PathFieldViewProps) {
  const [fieldValue, setValue] = useField(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const sourceKey = options.from ?? 'title'
  const sourceValue = useSiblingFieldValue(sourceKey)
  const source = typeof sourceValue === 'string' ? sourceValue : ''
  const editor = useEditor()
  const entry = useOptionalEntryAtoms()
  const untranslated = useAtomValueRaw(
    entry?.localeData.untranslated ?? notUntranslated
  )
  const slug = slugify(source)
  const followed = useRef({editor, slug})

  // While translating, the path follows its source until it is edited, so the
  // path shown is the path that is validated and saved
  useEffect(() => {
    const previous = followed.current
    followed.current = {editor, slug}
    if (!untranslated || previous.editor !== editor) return
    if (slug === previous.slug) return
    if (fieldValue === undefined || fieldValue === previous.slug) setValue(slug)
  }, [editor, fieldValue, setValue, slug, untranslated])

  return (
    <SlugField
      description={options.help}
      errorMessage={error}
      fieldValue={fieldValue}
      isReadOnly={options.readOnly}
      isRequired={options.required}
      label={options.label}
      shared={options.shared}
      source={source}
      onChange={setValue}
    />
  )
})
