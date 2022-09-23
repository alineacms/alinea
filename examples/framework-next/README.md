# A statically generated blog example using Next.js, alinea, and TypeScript

This is the existing [blog-starter](https://github.com/vercel/next.js/tree/canary/examples/blog-starter) Next.js example made editable with [Alinea CMS](https://alinea.sh).

## Demo

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/alineacms/alinea/tree/main/examples/framework-next)

## Deploy your own

Deploy the example using [Vercel](https://vercel.com)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/git/external?repository-url=https://github.com/alineacms/alinea/tree/main/examples/framework-next&project-name=alinea-blog&repository-name=alinea-blog)

## How to use

Create a new repository starting from this example:

```bash
npx degit alineacms/alinea/examples/framework-next alinea-blog
cd alinea-blog && git init -b main && yarn
```

Start developing:

```bash
yarn dev
```

If you're using a different package manager than yarn update the
`@alinea/content` package link to `file:.alinea`
([more info](https://alinea.sh/docs/reference/@alinea-content)).

The alinea dashboard is available at [http://localhost:4500](http://localhost:4500).
Your blog should be up and running on [http://localhost:3000](http://localhost:3000)! If it doesn't work, post on GitHub discussions.

Deploy it to the cloud with [Vercel](https://vercel.com/new) ([Documentation](https://nextjs.org/docs/deployment)).

# Notes

`blog-starter` uses [Tailwind CSS](https://tailwindcss.com) [(v3.0)](https://tailwindcss.com/blog/tailwindcss-v3).
