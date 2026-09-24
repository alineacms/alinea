import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {CatalogBrowser} from '@/page/catalog/CatalogBrowser'
import {CatalogCard} from '@/page/catalog/CatalogCard'
import {CatalogKind} from '@/page/catalog/CatalogKind'
import {ComponentThumb} from '@/page/catalog/ComponentThumb'
import {
  componentCatalog,
  componentHref,
  componentPreviewId
} from '@/page/catalog/componentCatalog'
import {componentMeta} from '@/page/catalog/componentProps'
import type {ComponentCatalogBlock} from '@/schema/blocks/ComponentCatalogBlock'
import css from './ComponentCatalogView.module.scss'
import {CodeCopyButton} from './code/CodeCopyButton'

const styles = styler(css)

const importCode = "import {Button, Dialog, Table} from 'alinea/components'"

export function ComponentCatalogView({
  showKind
}: Infer<typeof ComponentCatalogBlock>) {
  const total = componentCatalog.reduce(
    (count, group) => count + group.items.length,
    0
  )
  return (
    <div className={styles.root()}>
      {showKind && <CatalogKind active="components" />}
      <div className={styles.root.import()}>
        <code className={styles.root.import.code()}>
          <span className={styles.root.import.keyword()}>import</span>{' '}
          {'{Button, Dialog, Table}'}{' '}
          <span className={styles.root.import.keyword()}>from</span>{' '}
          <span className={styles.root.import.string()}>
            &apos;alinea/components&apos;
          </span>
        </code>
        <CodeCopyButton code={importCode} label="Copy import" />
      </div>
      <CatalogBrowser
        label="Filter components"
        noun="components"
        searchPlaceholder={`Search ${total} components`}
        groups={componentCatalog.map(group => ({
          id: group.id,
          label: group.label,
          title: group.title
        }))}
        items={componentCatalog.flatMap(group =>
          group.items.map(item => {
            const example = componentPreviewId(item.name)
            return {
              key: item.name,
              group: group.id,
              search: [
                item.name,
                ...item.parts,
                item.description,
                item.keywords ?? '',
                group.label
              ].join(' '),
              card: (
                <CatalogCard
                  kind="component"
                  href={componentHref(item.name)}
                  name={item.name}
                  code={`<${item.name}>`}
                  meta={componentMeta(item.name)}
                  preview={
                    example && (
                      <ComponentThumb
                        example={example}
                        scale={item.preview?.scale}
                        width={item.preview?.width}
                      />
                    )
                  }
                />
              )
            }
          })
        )}
      />
    </div>
  )
}
