import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {Fragment, type ReactNode} from 'react'
import {componentParts} from '@/page/catalog/componentProps'
import type {ComponentPropsBlock} from '@/schema/blocks/ComponentPropsBlock'
import css from './ComponentPropsView.module.scss'

const styles = styler(css)

/** Renders `code` spans in the descriptions of the declaration files */
function withCode(text: string): ReactNode {
  return text.split('`').map((part, index) =>
    index % 2 === 1 ? (
      <code key={index} className={styles.root.inline()}>
        {part}
      </code>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    )
  )
}

/** The props of every part of a component, from its props interfaces */
export function ComponentPropsView({
  component
}: Infer<typeof ComponentPropsBlock>) {
  const parts = component ? componentParts(component) : []
  if (parts.length === 0) return null
  const single = parts.length === 1
  return (
    <div className={styles.root()}>
      {parts.map(part => {
        const isHook = part.name.startsWith('use')
        return (
          <section key={part.name} className={styles.root.part()}>
            {!single && (
              <h3 className={styles.root.title()}>
                <code>{isHook ? `${part.name}()` : `<${part.name}>`}</code>
              </h3>
            )}
            {part.description && (
              <p className={styles.root.description()}>
                {withCode(part.description)}
              </p>
            )}
            {part.props.length > 0 && (
              <div className={styles.root.table()} role="table">
                <div className={styles.root.row('head')} role="row">
                  <span role="columnheader">Prop</span>
                  <span role="columnheader">Type</span>
                  <span role="columnheader">Default</span>
                  <span role="columnheader">Description</span>
                </div>
                {part.props.map(prop => (
                  <div key={prop.name} className={styles.root.row()} role="row">
                    <span role="cell" className={styles.root.prop()}>
                      {prop.name}
                      {prop.required && (
                        <span
                          className={styles.root.required()}
                          title="Required"
                        >
                          *
                        </span>
                      )}
                    </span>
                    <span role="cell" className={styles.root.type()}>
                      {prop.type}
                    </span>
                    <span role="cell" className={styles.root.default()}>
                      <span className={styles.root.label()}>Default </span>
                      {prop.defaultValue ?? '–'}
                    </span>
                    <span role="cell" className={styles.root.text()}>
                      {prop.description ? withCode(prop.description) : null}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {part.accepts.length > 0 && (
              <p className={styles.root.accepts()}>
                {part.props.length > 0 ? 'Also accepts ' : 'Accepts '}
                {withCode(
                  part.accepts.length > 1
                    ? `${part.accepts.slice(0, -1).join(', ')} and ${part.accepts.at(-1)}`
                    : part.accepts[0]
                )}
                .
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}
