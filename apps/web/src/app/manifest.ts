import type {MetadataRoute} from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Alinea CMS',
    short_name: 'Alinea',
    description: 'Open source, Git-based headless CMS for Next.js',
    start_url: '/',
    display: 'browser',
    background_color: '#ffffff',
    theme_color: '#3f61e8',
    icons: [{src: '/icon.svg', sizes: 'any', type: 'image/svg+xml'}]
  }
}
