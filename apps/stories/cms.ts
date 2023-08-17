import alinea, {createCMS} from 'alinea'

namespace schema {
  export const Page = alinea.type('Page', {
    title: alinea.text('Title', {width: 0.5, multiline: true}),
    path: alinea.path('Path', {width: 0.5})
  })

  export const Folder = alinea.type('Folder', {
    title: alinea.text('Title', {width: 0.5, multiline: true}),
    path: alinea.path('Path', {width: 0.5}),
    [alinea.meta]: {
      isContainer: true,
      contains: ['Page', 'Folder']
    }
  })
}

export const pages = alinea.root('Languages', {
  [alinea.meta]: {
    contains: ['Page', 'Folder'],
    i18n: {
      locales: ['en', 'fr', 'nl']
    }
  }
})

export const cms = createCMS({
  schema,
  workspaces: {
    primary: alinea.workspace('Multi language', {
      pages,
      media: alinea.media(),
      [alinea.meta]: {
        mediaDir: 'public',
        source: 'primary'
      }
    }),
    secondary: alinea.workspace('Secondary workspace', {
      pages: alinea.root('Pages', {
        [alinea.meta]: {
          contains: ['Page', 'Folder']
        }
      }),
      [alinea.meta]: {
        source: 'secondary'
      }
    })
  }
})
