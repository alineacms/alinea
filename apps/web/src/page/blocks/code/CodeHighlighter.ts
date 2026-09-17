import PLazy from 'p-lazy'
import languageShellScript from './ShikiBashLanguage'
import {theme} from './ShikiTheme'
import languageTsx from './ShikiTsxLanguage'

export const codeHighlighter = PLazy.from(async () => {
  const {getHighlighter} = await import('shiki')
  return getHighlighter({
    theme: {
      ...theme,
      type: 'light',
      settings: [],
      fg: '#1E232A',
      bg: 'white',
      colors: {
        ...theme.colors,
        'editor.background': 'var(--web-code-background)'
      }
    },
    langs: [
      {id: 'tsx', scopeName: 'source.tsx', grammar: languageTsx},
      {
        id: 'shellscript',
        scopeName: 'source.shell',
        grammar: languageShellScript
      }
    ]
  })
})
