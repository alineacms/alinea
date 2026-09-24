import {
  componentCatalog,
  componentHref,
  exampleLabel,
  isComponentExampleId
} from './componentCatalog'
import {componentParts} from './componentProps'
import {exampleSource} from './exampleSource'
import {fieldCatalog, otherFields} from './fieldCatalog'

// The catalogs degrade to plain lists in the Markdown export: Copy as
// Markdown, llms-full.txt and /start.md

export function fieldCatalogMarkdown() {
  const groups = fieldCatalog.map(group => {
    const items = group.items.map(
      item =>
        `- [${item.name}](${item.href}) (\`${item.call}\`, stores ${item.stores}${item.isNew ? ', new in 2.0' : ''}): ${item.description}`
    )
    return [`### ${group.title}`, ...items].join('\n')
  })
  const more = otherFields
    .map(field => `- \`${field.call}\`: ${field.description}`)
    .join('\n')
  return [
    'Fields are the building blocks of a schema: each stores a value and gives editors an input in the dashboard. To build React views for the dashboard, see [Components](/docs/components).',
    ...groups,
    `Also available:\n${more}`
  ].join('\n\n')
}

export function componentCatalogMarkdown() {
  const groups = componentCatalog.map(group => {
    const items = group.items.map(
      item =>
        `- [${item.name}](${componentHref(item.name)}): ${item.description}`
    )
    return [`### ${group.title}`, ...items].join('\n')
  })
  return [
    'Components are the React components the dashboard is built from, import them from `alinea/components` to build custom views. To model content, see [Fields](/docs/fields).',
    ...groups
  ].join('\n\n')
}

export function componentExampleMarkdown(id: string) {
  if (!isComponentExampleId(id)) return ''
  const code = exampleSource(id)
  if (!code) return ''
  return [`Example: ${exampleLabel(id)}`, '```tsx', code, '```'].join('\n')
}

function cell(text: string) {
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

export function componentPropsMarkdown(name: string) {
  return componentParts(name)
    .map(part => {
      const lines = [`\`${part.name}\``]
      if (part.description) lines.push(part.description)
      if (part.props.length > 0) {
        lines.push('| Prop | Type | Default | Description |')
        lines.push('| --- | --- | --- | --- |')
        for (const prop of part.props)
          lines.push(
            `| ${prop.name}${prop.required ? ' (required)' : ''} | \`${cell(prop.type)}\` | ${prop.defaultValue ? `\`${prop.defaultValue}\`` : ''} | ${cell(prop.description ?? '')} |`
          )
      }
      if (part.accepts.length > 0)
        lines.push(
          `${part.props.length > 0 ? 'Also accepts' : 'Accepts'} ${part.accepts.join(', ')}.`
        )
      return lines.join('\n')
    })
    .join('\n\n')
}
