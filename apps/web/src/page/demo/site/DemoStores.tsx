import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import type {DemoStoresBlock} from '@/schema/demo/DemoBlocks'
import {DemoContainer} from './DemoContainer'
import {DemoImage} from './DemoImage'
import {DemoSectionHeader} from './DemoSectionHeader'
import css from './DemoStores.module.scss'

const styles = styler(css)

export interface DemoStoresProps extends Infer<typeof DemoStoresBlock> {}

export function DemoStores({title, stores}: DemoStoresProps) {
  if (!stores?.length) return null
  return (
    <section className={styles.DemoStores()}>
      <DemoContainer>
        {title && <DemoSectionHeader title={title} />}
        <div className={styles.DemoStores.grid()}>
          {stores.map(store => (
            <article key={store._id} className={styles.DemoStores.store()}>
              <DemoImage
                image={store.image}
                ratio="3 / 2"
                className={styles.DemoStores.image()}
              />
              <h3 className={styles.DemoStores.heading()}>{store.name}</h3>
              <div className={styles.DemoStores.details()}>
                <p className={styles.DemoStores.detail()}>{store.address}</p>
                <p className={styles.DemoStores.detail()}>{store.hours}</p>
              </div>
              {store.phone && (
                <a
                  href={`tel:${store.phone.replace(/\s/g, '')}`}
                  className={styles.DemoStores.phone()}
                >
                  {store.phone}
                </a>
              )}
              {store.note && (
                <p className={styles.DemoStores.note()}>{store.note}</p>
              )}
            </article>
          ))}
        </div>
      </DemoContainer>
    </section>
  )
}
