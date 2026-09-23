import {withAlinea} from 'alinea/next'
import type {NextConfig} from 'next'

// Docs urls that moved when the docs were regrouped for 2.0
const docsRedirects: Array<[source: string, destination: string]> = [
  // The framework picker is gone, only Next.js is documented
  ['/docs\\:next', '/docs'],
  ['/docs\\:next/:path*', '/docs/:path*'],
  ['/docs/next', '/docs'],
  ['/docs/next/:path*', '/docs/:path*'],
  // Get started
  ['/docs/getting-started', '/docs/quickstart'],
  // Content model
  ['/docs/configuration/schema', '/docs/schema'],
  ['/docs/configuration/schema/:path*', '/docs/schema/:path*'],
  ['/docs/configuration/fields/custom-fields', '/docs/custom-fields'],
  ['/docs/configuration/fields', '/docs/fields'],
  ['/docs/configuration/fields/:path*', '/docs/fields/:path*'],
  ['/docs/configuration/workspaces', '/docs/workspaces'],
  ['/docs/configuration/workspaces/:path*', '/docs/workspaces/:path*'],
  ['/docs/content', '/docs/content-model'],
  ['/docs/content/query', '/docs/query'],
  ['/docs/content/query/:path*', '/docs/query/:path*'],
  // Guides
  ['/docs/content/live-previews', '/docs/live-previews'],
  ['/docs/content/editing-content', '/docs/editing-content'],
  ['/docs/content/typescript', '/docs/typescript'],
  ['/docs/reference/internationalization', '/docs/internationalization'],
  ['/docs/configuration/roles-permissions', '/docs/roles-permissions'],
  ['/docs/reference/agents-playbook', '/docs/ai-agents'],
  // Reference
  ['/docs/reference/cli', '/docs/cli']
]

const nextConfig: NextConfig = {
  reactStrictMode: false,
  typescript: {
    // We check types in plenty other places, no need to waste time here
    ignoreBuildErrors: true
  },
  async redirects() {
    return [
      {
        source: '/llms.txt',
        destination: '/llms-full.txt',
        permanent: true
      },
      ...docsRedirects.map(([source, destination]) => ({
        source,
        destination,
        permanent: true
      }))
    ]
  }
}

export default withAlinea(nextConfig)
