import '@/global.scss'
import type {Metadata, Viewport} from 'next'
import type {PropsWithChildren} from 'react'
import {siteName, siteUrl} from '@/utils/metadata'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteName,
  applicationName: siteName
}

export const viewport: Viewport = {
  themeColor: '#3f61e8'
}

export default async function RootLayout({children}: PropsWithChildren) {
  return (
    <html lang="en">
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <style>
          {`@media (max-width: 440px) {html {font-size: calc(4.4444vw + .00012px)}}`}
        </style>
      </head>
      <body>{children}</body>
    </html>
  )
}
