import Head from 'next/head'
import ogImage from '../media/og.png'

export function SEO({
  title = 'Alinea - Open source headless CMS',
  description = 'Alinea is an open source content management system written in TypeScript. Structure, edit and query content with any web framework.'
}) {
  return (
    <Head>
      <meta name="description" content={description} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage.src} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="600" />
      <meta
        property="og:site_name"
        content="Alinea - Open source headless CMS"
      />

      <meta name="twitter:image:src" content={ogImage.src} />
      <meta name="twitter:site" content="@alineacms" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </Head>
  )
}
