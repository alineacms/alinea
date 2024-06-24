import {Field} from 'alinea/core'
import {PreviewMetadata} from 'alinea/core/Resolver'
import {FormRow} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {useFieldOptions} from 'alinea/dashboard/editor/UseField'
import {useEntryEditor} from 'alinea/dashboard/hook/UseEntryEditor'
import {usePreviewMetadata} from 'alinea/dashboard/view/preview/BrowserPreview'
import {fromModule} from 'alinea/ui'
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
      <div>{editor?.preview && <MetadataPreview />}</div>
    </>
  )
}

function MetadataPreview() {
  const metadata = usePreviewMetadata()
  if (!metadata) return null

  return (
    <div>
      <h2>Share preview</h2>
      <SearchEnginePreview metaTags={metadata} />
      <OpenGraphPreview metaTags={metadata} />
    </div>
  )
}

const SearchEnginePreview = ({metaTags}: {metaTags: PreviewMetadata}) => {
  return (
    <div className={styles.searchengine()}>
      <cite>https://blabla</cite>
      <h3>{metaTags['title']}</h3>
      <p>{metaTags['description']}</p>
    </div>
  )
}

const OpenGraphPreview = ({metaTags}: {metaTags: PreviewMetadata}) => {
  return (
    <div className={styles.opengraph()}>
      <img src={metaTags['og:image']} alt="Preview" />
      <h3>{metaTags['og:title'] || metaTags['title']}</h3>
      <p>{metaTags['og:description']}</p>
      <cite>{metaTags['og:url']}</cite>
    </div>
  )
}
