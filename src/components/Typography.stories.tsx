import {Blockquote} from './Blockquote.js'
import {Code} from './Code.js'
import {Heading} from './Heading.js'
import {Kbd} from './Kbd.js'
import {Link} from './Link.js'
import {Text} from './Text.js'

export function Headings() {
  return (
    <div style={{display: 'grid', gap: 12, padding: 24}}>
      <Heading as="h1">Articles</Heading>
      <Heading as="h2">Recently published</Heading>
      <Heading as="h3">Metadata</Heading>
      <Heading as="h4">Search engine preview</Heading>
      <Heading as="h5">Open graph</Heading>
      <Heading as="h2" size="sm" weight="medium">
        Visual size is independent of the element
      </Heading>
    </div>
  )
}

export function Paragraphs() {
  return (
    <div style={{display: 'grid', gap: 12, maxWidth: 560, padding: 24}}>
      <Text as="p" size="lg">
        Alinea stores content as files in your repository, so every change is
        reviewed and versioned like code.
      </Text>
      <Text as="p">
        Fields are grouped in types. Each entry has a{' '}
        <Text weight="semibold">title</Text>, a <Code>path</Code> and any fields
        you define. Read more in the{' '}
        <Link href="#docs" variant="underline">
          documentation
        </Link>
        .
      </Text>
      <Text as="p" size="sm" color="muted">
        Last edited by Maarten, 2 hours ago
      </Text>
      <Text as="p" size="xs" color="muted">
        Changes are saved as drafts until published.
      </Text>
      <div style={{display: 'flex', gap: 16}}>
        <Text color="primary">Primary</Text>
        <Text color="destructive">Destructive</Text>
        <Text color="warning">Warning</Text>
      </div>
      <Text as="p" truncate style={{maxWidth: 240}}>
        A very long line that gets truncated with an ellipsis at the end
      </Text>
    </div>
  )
}

export function Monospace() {
  return (
    <div style={{display: 'grid', gap: 12, maxWidth: 560, padding: 24}}>
      <Text as="p">
        Inline <Code>alinea.config.tsx</Code>,{' '}
        <Code variant="outline">Config.document()</Code> and{' '}
        <Code variant="ghost">ghost</Code> code.
      </Text>
      <Code block>
        {`const Article = Config.document('Article', {
  fields: {
    title: Field.text('Title'),
    body: Field.richText('Body')
  }
})`}
      </Code>
      <Text as="p">
        Open search with <Kbd>⌘ K</Kbd>, save with <Kbd>⌘</Kbd> <Kbd>S</Kbd>.
      </Text>
      <Blockquote>
        Content editing should stay close to the structure of the site.
      </Blockquote>
    </div>
  )
}

export default {
  title: 'Pure components / Typography'
}
