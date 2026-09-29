import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {Section} from '@/layout/Section'
import type {CodeShowcase as CodeShowcaseSchema} from '@/schema/sections/CodeShowcase'
import {ArrowLink} from './ArrowLink'
import {CheckList} from './CheckList'
import css from './CodeShowcase.module.scss'
import {CodeSnippet} from './CodeSnippet'
import {resolveLink} from './links'

const styles = styler(css)

export interface CodeShowcaseProps extends Infer<typeof CodeShowcaseSchema> {}

interface TooltipLineProps {
  line: string
}

/** Colors type annotations (`name: type`) and leading keywords */
function TooltipLine({line}: TooltipLineProps) {
  const keyword = /^(\s*)(const|let|type|interface)(\s.*)$/.exec(line)
  if (keyword)
    return (
      <>
        {keyword[1]}
        <span className={styles.root.tooltip.keyword()}>{keyword[2]}</span>
        {keyword[3]}
      </>
    )
  const property = /^(\s*[\w$]+\??:\s*)(.+)$/.exec(line)
  if (property)
    return (
      <>
        {property[1]}
        <span className={styles.root.tooltip.type()}>{property[2]}</span>
      </>
    )
  return <>{line}</>
}

export function CodeShowcase({
  title,
  text,
  checks,
  link,
  filename,
  code,
  tooltip
}: CodeShowcaseProps) {
  const lines = tooltip?.replace(/\s+$/, '').split('\n') ?? []
  return (
    <Section>
      <div className={styles.root()}>
        <div className={styles.root.content()}>
          {title && <h2 className={styles.root.title()}>{title}</h2>}
          {text && <p className={styles.root.text()}>{text}</p>}
          <CheckList items={checks} size="large" />
          <ArrowLink link={resolveLink(link)} />
        </div>
        {code && (
          <div className={styles.root.code()}>
            <CodeSnippet
              size="large"
              filename={filename}
              code={code}
              className={styles.root.snippet()}
            />
            {lines.length > 0 && (
              <pre className={styles.root.tooltip()}>
                {lines.map((line, i) => (
                  <span key={i} className={styles.root.tooltip.line()}>
                    <TooltipLine line={line} />
                  </span>
                ))}
              </pre>
            )}
          </div>
        )}
      </div>
    </Section>
  )
}
