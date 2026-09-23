import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {Button} from '@/layout/Button'
import {Label} from '@/layout/Label'
import {Section} from '@/layout/Section'
import {SectionHeader} from '@/layout/SectionHeader'
import type {FeatureGrid as FeatureGridSchema} from '@/schema/sections/FeatureGrid'
import css from './FeatureGrid.module.scss'
import {resolveLink} from './links'
import {SectionIcon} from './SectionIcon'

const styles = styler(css)

export interface FeatureGridProps extends Infer<typeof FeatureGridSchema> {}

export function FeatureGrid({
  title,
  label,
  description,
  link,
  panel,
  items
}: FeatureGridProps) {
  const action = resolveLink(link)
  return (
    <Section>
      <div className={styles.root({panel})}>
        {(title || action) && (
          <div className={styles.root.header()}>
            <SectionHeader
              title={title}
              label={label || undefined}
              description={description || undefined}
              className={styles.root.heading()}
            />
            {action && (
              <Button
                variant="secondary"
                href={action.href}
                target={action.target}
                className={styles.root.action()}
              >
                {action.label} →
              </Button>
            )}
          </div>
        )}
        {items?.length > 0 && (
          <div className={styles.root.grid()}>
            {items.map(item => (
              <article key={item._id} className={styles.item()}>
                {(item.icon || item.tag) && (
                  <div className={styles.item.top()}>
                    {item.icon && (
                      <span className={styles.item.icon()}>
                        <SectionIcon name={item.icon} />
                      </span>
                    )}
                    {item.tag && (
                      <Label size="small" className={styles.item.tag()}>
                        {item.tag}
                      </Label>
                    )}
                  </div>
                )}
                {item.title && (
                  <h3 className={styles.item.title()}>{item.title}</h3>
                )}
                {item.text && <p className={styles.item.text()}>{item.text}</p>}
              </article>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}
