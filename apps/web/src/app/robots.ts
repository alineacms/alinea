import type {MetadataRoute} from 'next'
import {siteUrl} from '@/utils/metadata'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // The dashboard and api routes have nothing to index
      disallow: ['/admin', '/api/']
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl
  }
}
