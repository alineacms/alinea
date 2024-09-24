import {PreviewMetadata} from 'alinea/core/Resolver'
import {FormRow} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {useFieldOptions} from 'alinea/dashboard/editor/UseField'
import {useEntryEditor} from 'alinea/dashboard/hook/UseEntryEditor'
import {usePreviewMetadata} from 'alinea/dashboard/view/preview/BrowserPreview'
import {fromModule} from 'alinea/ui'
import {MetadataField} from './MetadataField.js'
import css from './MetadataField.module.scss'

const styles = fromModule(css)

export interface MetadataInputProps {
  field: MetadataField
}

export function MetadataInput({field}: MetadataInputProps) {
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
    <div className={styles.preview()}>
      <h2>Share preview</h2>
      <SearchEnginePreview metaTags={metadata} />
      <OpenGraphPreview metaTags={metadata} />
    </div>
  )
}

const SearchEnginePreview = ({metaTags}: {metaTags: PreviewMetadata}) => {
  return (
    <>
      <h4 className={styles.preview.subtitle()}>Search engine</h4>
      <div className={styles.searchengine()}>
        <div className={styles.searchengine.intro()}>
          <div className={styles.searchengine.intro.favicon()}>
            <span className={styles.searchengine.intro.favicon.icon()}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"
                />
              </svg>
            </span>
          </div>
          <div style={{minWidth: 0}}>
            {metaTags['og:site_name'] && (
              <p className={styles.searchengine.intro.sitename()}>
                {metaTags['og:site_name']}
              </p>
            )}
            <p className={styles.searchengine.intro.url()}>
              {metaTags['og:url']}
            </p>
          </div>
        </div>
        <h3 className={styles.searchengine.title()}>{metaTags['title']}</h3>
        {metaTags['description'] && (
          <p className={styles.searchengine.description()}>
            {metaTags['description']?.substring(0, 160)}
          </p>
        )}
      </div>
    </>
  )
}

const OpenGraphPreview = ({metaTags}: {metaTags: PreviewMetadata}) => {
  return (
    <>
      <h4 className={styles.preview.subtitle()}>Social share</h4>
      <div className={styles.opengraph()}>
        <img
          src={metaTags['og:image']}
          alt="Open Graph image"
          className={styles.opengraph.img()}
        />
        <div className={styles.opengraph.body()}>
          <p className={styles.opengraph.body.url()}>
            {metaTags['og:url']?.replace(/^https?:\/\//, '')}
          </p>
          <div className={styles.opengraph.body.content()}>
            <h3 className={styles.opengraph.body.content.title()}>
              {metaTags['og:title'] || metaTags['title']}
            </h3>
            <p className={styles.opengraph.body.content.description()}>
              {metaTags['og:description']}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
