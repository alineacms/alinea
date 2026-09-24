import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import Link from 'next/link'
import {CatalogBrowser} from '@/page/catalog/CatalogBrowser'
import {CatalogCard} from '@/page/catalog/CatalogCard'
import {CatalogKind} from '@/page/catalog/CatalogKind'
import {FieldPreview} from '@/page/catalog/FieldPreview'
import {fieldCatalog, otherFields} from '@/page/catalog/fieldCatalog'
import type {FieldCatalogBlock} from '@/schema/blocks/FieldCatalogBlock'
import css from './FieldCatalogView.module.scss'

const styles = styler(css)

export function FieldCatalogView({showKind}: Infer<typeof FieldCatalogBlock>) {
  return (
    <div className={styles.root()}>
      {showKind && <CatalogKind active="fields" />}
      <CatalogBrowser
        label="Filter fields"
        noun="fields"
        groups={fieldCatalog.map(group => ({
          id: group.id,
          label: group.title,
          title: group.title
        }))}
        items={fieldCatalog.flatMap(group =>
          group.items.map(item => ({
            key: item.key,
            group: group.id,
            search: `${item.name} ${item.call} ${item.stores} ${item.description}`,
            card: (
              <CatalogCard
                kind="field"
                href={item.href}
                name={item.name}
                code={item.call}
                meta={item.stores}
                badge={item.isNew ? 'New in 2.0' : undefined}
                preview={<FieldPreview field={item.key} label={item.name} />}
              />
            )
          }))
        )}
      />
      <p className={styles.root.more()}>
        Also available:{' '}
        {otherFields.map((field, index) => (
          <span key={field.call}>
            <code className={styles.root.more.code()} title={field.description}>
              {field.call}
            </code>
            {index < otherFields.length - 2
              ? ', '
              : index === otherFields.length - 2
                ? ' and '
                : '. '}
          </span>
        ))}
        Need something else?{' '}
        <Link href="/docs/custom-fields" className={styles.root.more.link()}>
          Build a custom field
        </Link>{' '}
        with the dashboard{' '}
        <Link href="/docs/components" className={styles.root.more.link()}>
          components
        </Link>
        .
      </p>
    </div>
  )
}
