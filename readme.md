[![npm](https://img.shields.io/npm/v/alinea.svg)](https://npmjs.org/package/alinea)
[![install size](https://packagephobia.com/badge?p=alinea)](https://packagephobia.com/result?p=alinea)
[![license](https://img.shields.io/npm/l/alinea.svg)](LICENSE)

# [Alinea CMS](https://alineacms.com)

Alinea is an open source, Git-based headless CMS for Next.js. You define your
content model in TypeScript, editors work in a dashboard that ships with your
app, and every entry is stored as a JSON file in your repository.

[Docs](https://alineacms.com/docs) ·
[Demo](https://alineacms.com/demo) ·
[Alinea Cloud](https://www.alinea.cloud/app) ·
[Changelog](changelog.md)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/alineacms/alinea/main/.github/assets/dashboard-product-dark.webp" />
  <img alt="The Alinea dashboard editing a product entry, with a live preview of the page next to the form" src="https://raw.githubusercontent.com/alineacms/alinea/main/.github/assets/dashboard-product.webp" />
</picture>

- **Content in git**: every entry is a JSON file in your repository. Review,
  branch and roll back content like code.
- **Typed, no codegen**: query types come straight from your schema.
- **No database server for content**: content is indexed in SQLite and bundled
  with your site, with full text search in the dashboard.
- **Live previews**: add one component to your layout and pages preview drafts
  as editors type, rendered by your server components.
- **Instant publishing**: every publish is a git commit, and deployed sites
  pick up new content without waiting for a rebuild.
- **An accessible dashboard**: built on React Aria Components, with dark mode,
  entry history, roles and permissions, and per-field translations.
- **Self-host or Cloud**: run the backend on your own database, or let
  [Alinea Cloud](https://www.alinea.cloud/app) handle sign-in and publishing.

## Quick start

Alinea requires Node.js 24 or higher, React 19 and the Next.js App Router.
In a Next.js project:

```sh
npm install alinea
npx alinea init
```

`alinea init` creates `cms.ts` with your schema and settings, the API route
the dashboard talks to (`app/(alinea)/api/cms/route.ts`), a first entry in
`content/pages`, and rewrites your `dev` and `build` scripts to run through
Alinea. Then wrap your Next.js config:

```ts
// next.config.ts
import {withAlinea} from 'alinea/next'

export default withAlinea({
  // Your Next.js options
})
```

Start the dev server with `npm run dev` and open the dashboard at
http://localhost:3000/admin.

[Read the full quickstart →](https://alineacms.com/docs/quickstart)

## Define your content

Types and fields are plain TypeScript in `cms.ts`. Every document gets a
title and a path.

```ts
// cms.ts
import {Config, Field} from 'alinea'
import {createCMS} from 'alinea/next'

export const BlogPost = Config.document('Blog post', {
  fields: {
    publishDate: Field.date('Publish date'),
    cover: Field.image('Cover image'),
    body: Field.richText('Body')
  }
})

export const Blog = Config.document('Blog', {
  contains: [BlogPost]
})

export const cms = createCMS({
  schema: {Blog, BlogPost},
  workspaces: {
    main: Config.workspace('My site', {
      source: 'content',
      mediaDir: 'public/media',
      roots: {
        pages: Config.root('Pages', {contains: [Blog]}),
        media: Config.media()
      }
    })
  },
  baseUrl: {
    development: 'http://localhost:3000',
    production: 'https://example.com'
  },
  handlerUrl: '/api/cms',
  adminPath: '/admin'
})
```

[Schema and fields →](https://alineacms.com/docs/schema)

## Query it

Query content in server components. Results are typed from your schema, and
`select` returns exactly the shape you ask for, including related entries.

```tsx
// app/blog/page.tsx
import {Blog, BlogPost, cms} from '@/cms'
import {Query} from 'alinea'

export default async function BlogPage() {
  const blog = await cms.get({
    type: Blog,
    select: {
      title: Query.title,
      posts: Query.children({
        type: BlogPost,
        select: {title: Query.title, url: Query.url, date: BlogPost.publishDate},
        orderBy: {desc: BlogPost.publishDate}
      })
    }
  })
  return (
    <main>
      <h1>{blog.title}</h1>
      {blog.posts.map(post => (
        <a key={post.url} href={post.url}>
          {post.title}
        </a>
      ))}
    </main>
  )
}
```

[Queries →](https://alineacms.com/docs/query) ·
[Live previews →](https://alineacms.com/docs/live-previews) ·
[Deploy →](https://alineacms.com/docs/deploy)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/alineacms/alinea/main/.github/assets/dashboard-overview-dark.webp" />
  <img alt="The Alinea dashboard listing products in a sortable table with image, price, material and stock columns" src="https://raw.githubusercontent.com/alineacms/alinea/main/.github/assets/dashboard-overview.webp" />
</picture>

## Coding agents

The npm package includes the full documentation in `llms-full.txt`, and
`alinea dev` runs an MCP server (`http://localhost:4500/mcp`) so agents can
read your schema and create, edit and publish entries through the same save
path as the dashboard.

```sh
claude mcp add --transport http alinea http://localhost:4500/mcp
```

[AI agents →](https://alineacms.com/docs/ai-agents)

## Upgrading from 1.x

See the [upgrade guide](https://alineacms.com/docs/upgrading) and the
[changelog](changelog.md).

## Contributing

Have a question or an idea? Found a bug? Read how to
[contribute](contributing.md).

## License

[MIT](LICENSE)
