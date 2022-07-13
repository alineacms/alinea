import type {Pages} from '@alinea/backend'
import {Expr} from '@alinea/store'
import {getHighlighter} from 'shiki'
import languageShellScript from '../types/ShikiBashLanguage'
import {theme} from '../types/ShikiTheme'
import languageTsx from '../types/ShikiTsxLanguage'

const highlighter = getHighlighter({
  theme: {
    ...theme,
    type: 'light',
    settings: [],
    fg: '#1E232A',
    bg: 'white',
    colors: {...theme.colors, 'editor.background': 'var(--web-code-background)'}
  },
  langs: [
    {id: 'tsx', scopeName: 'source.tsx', grammar: languageTsx},
    {id: 'shellscript', scopeName: 'source.shell', grammar: languageShellScript}
  ]
})

export function transformCode(field: Expr<string>, pages: Pages<any>) {
  return pages.process(field, async code => {
    if (!code) return ''
    const {codeToHtml} = await highlighter
    return codeToHtml(code, {
      lang: code.startsWith('#') ? 'shellscript' : 'tsx'
    })
  })
}
