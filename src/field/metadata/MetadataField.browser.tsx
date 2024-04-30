import {Field} from 'alinea/core'
import {Type} from 'alinea/core/Type'
import {entries} from 'alinea/core/util/Objects'
import {
  FormAtoms,
  FormRow,
  useFormContext
} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {useFieldOptions} from 'alinea/dashboard/editor/UseField'
import {useAtomValue} from 'jotai'
import {atomEffect} from 'jotai-effect'
import {useMemo} from 'react'
import {MetadataField, metadata as createMetadata} from './MetadataField.js'
export * from './MetadataField.js'

export const metadata = Field.provideView(MetadataInput, createMetadata)

interface MetadataInputProps {
  field: MetadataField
}

function MetadataInput({field}: MetadataInputProps) {
  //const form = useFormContext()
  const options = useFieldOptions(field)
  /*const defaultFields = useMemo(
    () => findMetadataFields(form.type),
    [form.type]
  )*/
  return (
    <FormRow type={options.fields} field={field}>
      {/*<TrackFields
        defaultFields={defaultFields}
        field={field}
        rootForm={form}
  />*/}
      <InputForm type={options.fields} border={false} />
    </FormRow>
  )
}

function findMetadataFields(type: Type) {
  let titleField, descriptionField, imageField
  for (const [key, field] of entries(Type.fields(type))) {
    const options = Field.options(field)
    if ('providesTitle' in options) titleField = field
    if ('providesDescription' in options) descriptionField = field
    if ('providesImage' in options) imageField = field
  }
  return {titleField, descriptionField, imageField}
}

interface TrackFieldsProps {
  field: MetadataField
  rootForm: FormAtoms
  defaultFields: {
    titleField?: Field
    descriptionField?: Field
    imageField?: Field
  }
}

function TrackFields(props: TrackFieldsProps) {
  const metaForm = useFormContext()
  useDefaults(metaForm, props)
  return null
}

function useDefaults(
  metaForm: FormAtoms,
  {rootForm, field, defaultFields}: TrackFieldsProps
) {
  const metaInfo = rootForm.fieldInfo(field)
  const options = useFieldOptions(field)
  const {titleField, descriptionField, imageField} = defaultFields
  const activeField = metaForm.fieldInfo(options.fields.useDefaults)
  const titleInfo = titleField && rootForm.fieldInfo(titleField)
  const descriptionInfo =
    descriptionField && rootForm.fieldInfo(descriptionField)
  const imageInfo = imageField && rootForm.fieldInfo(imageField)
  const ogForm = metaForm.innerForm(
    Field.options(options.fields.openGraph).fields,
    'openGraph',
    undefined
  )
  const ogTitle = ogForm.fieldInfo(ogForm.fieldByKey('title'))
  const ogDescription = ogForm.fieldInfo(ogForm.fieldByKey('description'))
  const ogImage = ogForm.fieldInfo(ogForm.fieldByKey('image'))
  useAtomValue(
    useMemo(
      () =>
        atomEffect((get, set) => {
          const isActive = get(activeField.value)
          if (!isActive) return
          if (!titleInfo) return
          const titleValue = get(titleInfo.value)
          metaInfo.mutator.set('title', titleValue)
          ogTitle.mutator(titleValue)
        }),
      []
    )
  )
  useAtomValue(
    useMemo(
      () =>
        atomEffect((get, set) => {
          const isActive = get(activeField.value)
          if (!isActive) return
          if (!descriptionInfo) return
          const descriptionValue = get(descriptionInfo.value)
          metaInfo.mutator.set('description', descriptionValue)
          ogDescription.mutator(descriptionValue)
        }),
      []
    )
  )
  useAtomValue(
    useMemo(
      () =>
        atomEffect((get, set) => {
          const isActive = get(activeField.value)
          if (!isActive) return
          if (!imageInfo) return
          const imageValue = get(imageInfo.value)
          ogImage.mutator(imageValue)
        }),
      []
    )
  )
}
