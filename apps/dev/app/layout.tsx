import {cms} from '@/cms'

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body>
        {children}

        <cms.previews widget />
      </body>
    </html>
  )
}
