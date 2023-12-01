import '@/global.scss'
import {btoa} from 'alinea/core/util/Encoding'
import {PropsWithChildren} from 'react'

export const metadata = {
  title: 'Alinea'
}

const color = '#4a65e8'

const favicon = btoa(
  `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.145 6.55682V8.42614C18.8569 6.91477 16.9442 6 14.329 6C9.21561 6 5 10.5739 5 16.5C5 22.4261 9.21561 27 14.329 27C16.9442 27 18.8569 26.0852 20.145 24.5739V26.4432H26V6.55682H20.145ZM15.5 21.3523C12.8067 21.3523 10.855 19.483 10.855 16.5C10.855 13.517 12.8067 11.6477 15.5 11.6477C18.1933 11.6477 20.145 13.517 20.145 16.5C20.145 19.483 18.1933 21.3523 15.5 21.3523Z" fill="${color}"/>
  </svg>`
)

export default async function Layout({children}: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content={color} />
        <style>
          {`@media (max-width: 440px) {html {font-size: calc(4.4444vw + .00012px)}}`}
        </style>
        <link
          rel="icon"
          type="image/svg"
          href={`data:image/svg+xml;base64,${favicon}`}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
