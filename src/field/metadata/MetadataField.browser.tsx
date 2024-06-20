import {Field} from 'alinea/core'
import {Preview} from 'alinea/core/Preview'
import {PreviewMetadata} from 'alinea/core/Resolver'
import {EntryEditor} from 'alinea/dashboard/atoms/EntryEditorAtoms'
import {FormRow} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {useFieldOptions} from 'alinea/dashboard/editor/UseField'
import {useEntryEditor} from 'alinea/dashboard/hook/UseEntryEditor'
import {usePreviewMetadata} from 'alinea/dashboard/view/preview/BrowserPreview'
import {Loader} from 'alinea/ui/Loader'
import {fromModule} from '../../ui.js'
import {MetadataField, metadata as createMetadata} from './MetadataField.js'
import css from './MetadataField.module.scss'

export * from './MetadataField.js'
const styles = fromModule(css)

export const metadata = Field.provideView(MetadataInput, createMetadata)

interface MetadataInputProps {
  field: MetadataField
}

function MetadataInput({field}: MetadataInputProps) {
  const options = useFieldOptions(field)
  const editor = useEntryEditor()

  return (
    <>
      <FormRow type={options.fields} field={field}>
        <InputForm type={options.fields} border={false} />
      </FormRow>
      <div>
        {editor?.preview && (
          <MetadataPreview editor={editor} preview={editor?.preview} />
        )}
      </div>
    </>
  )
}

function MetadataPreview({
  editor,
  preview
}: {
  editor: EntryEditor
  preview: Preview
}) {
  const metadata = usePreviewMetadata()
  console.log(metadata)

  if (!metadata) return <Loader />
  return (
    <div>
      <h2>Share preview</h2>
      <FacebookSharePreview metaTags={metadata} />
    </div>
  )
}

const GoogleSearchResultPreview = ({metaTags}: {metaTags: PreviewMetadata}) => {
  return (
    <div className={styles.google()}>
      <h3>{metaTags['og:title'] || metaTags['title']}</h3>
      <p>{metaTags['og:description'] || metaTags['description']}</p>
      <cite>{metaTags['og:url']}</cite>
    </div>
  )
}

const FacebookSharePreview = ({metaTags}: {metaTags: PreviewMetadata}) => {
  return (
    <div className={styles.facebook()}>
      <img src={metaTags['og:image']} alt="Preview" />
      <h3>{metaTags['og:title'] || metaTags['title']}</h3>
      <p>{metaTags['og:description']}</p>
      <cite>{metaTags['og:url']}</cite>
    </div>
  )
}
