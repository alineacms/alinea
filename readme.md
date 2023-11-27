[![npm](https://img.shields.io/npm/v/alinea.svg)](https://npmjs.org/package/alinea)
[![install size](https://packagephobia.com/badge?p=alinea)](https://packagephobia.com/result?p=alinea)

# [![Alinea CMS logo](https://github.com/alineacms/alinea/raw/HEAD/apps/web/public/logo.svg)](https://alinea.sh)

Alinea is a modern content management system.

- Content is stored in flat files and committed to your repository
- Content is easily queryable through an in-memory SQLite database
- Content is fully typed

## Get started

Install alinea in your project directory

```sh
npm install alinea
```

Initialize alinea's config file

```sh
npx alinea init --next
```

Open the dashboard to have a look around

```sh
npx alinea dev
```

[Start configuring types and fields →](https://alinea.sh/docs/configuration)

## Configure

Configure alinea in `cms.tsx`

```tsx
const BlogPost = alinea.type('Blog post', {
  title: alinea.text('Blog entry title'),
  body: alinea.richText('Body text')
})
```

[Type options and fields →](https://alinea.sh/docs/configuration)

## Query

Retrieve content fully-typed and filter, order, limit and join as needed.  
Select only the fields you need.

```tsx
import {cms} from '@/cms'
console.log(
  await cms.find(
    BlogPost().where(
      BlogPost.author.is('Me')
    ).select(
      {title: BlogPost.title}
    )
  )
)
```

[See the full api →](https://alinea.sh/docs/content/query)

Content is available during static site generation and when server side querying.  
Content is bundled with your code and can be queried with zero network overhead.

[How alinea bundles content →](https://alinea.sh/docs/content)

## Deploy anywhere

Alinea supports custom backends that can be hosted as a simple Node.js process or on serverless runtimes.

[Setup your backend →](https://alinea.sh/docs/deploy)

## How to contribute to this project

Have a question or an idea? Found a bug? Read how to [contribute](contributing.md).
