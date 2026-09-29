import styler from '@alinea/styler'
import type {Content, Root} from 'mdast'
import type {ReactNode} from 'react'
import {remark} from 'remark'
import css from './ChangelogMarkdown.module.scss'

const styles = styler(css)

const safeProtocol = /^(https?:|mailto:|\/|#)/i

function renderChildren(nodes: Array<Content>): Array<ReactNode> {
  return nodes.map(renderNode)
}

function renderNode(node: Content, key: number): ReactNode {
  switch (node.type) {
    case 'text':
      return node.value
    case 'inlineCode':
      return (
        <code key={key} className={styles.code()}>
          {node.value}
        </code>
      )
    case 'emphasis':
      return <em key={key}>{renderChildren(node.children)}</em>
    case 'strong':
      return <strong key={key}>{renderChildren(node.children)}</strong>
    case 'delete':
      return <del key={key}>{renderChildren(node.children)}</del>
    case 'break':
      return <br key={key} />
    case 'link': {
      const children = renderChildren(node.children)
      if (!safeProtocol.test(node.url)) return <span key={key}>{children}</span>
      return (
        <a key={key} href={node.url} className={styles.link()}>
          {children}
        </a>
      )
    }
    case 'paragraph':
      return (
        <p key={key} className={styles.paragraph()}>
          {renderChildren(node.children)}
        </p>
      )
    case 'code':
      return (
        <pre key={key} className={styles.pre()}>
          <code className={styles.pre.code()}>{node.value}</code>
        </pre>
      )
    case 'list': {
      const items = node.children.map((item, index) => (
        <li key={index} className={styles.list.item()}>
          {renderChildren(item.children)}
        </li>
      ))
      return node.ordered ? (
        <ol key={key} className={styles.list()}>
          {items}
        </ol>
      ) : (
        <ul key={key} className={styles.list()}>
          {items}
        </ul>
      )
    }
    case 'html':
      // Raw html is shown as text, never injected
      return node.value
    default:
      if ('children' in node) return renderChildren(node.children as Content[])
      if ('value' in node && typeof node.value === 'string') return node.value
      return null
  }
}

export interface ChangelogMarkdownProps {
  source: string
}

/** Renders a changelog bullet; a single paragraph is rendered inline */
export function ChangelogMarkdown({source}: ChangelogMarkdownProps) {
  const root = remark().parse(source) as Root
  const [first] = root.children
  if (root.children.length === 1 && first.type === 'paragraph')
    return <>{renderChildren(first.children)}</>
  return <div className={styles.root()}>{renderChildren(root.children)}</div>
}
