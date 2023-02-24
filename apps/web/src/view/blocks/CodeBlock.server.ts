import type {Pages} from 'alinea/backend'
import {Expr} from 'alinea/store'
import type {Highlighter} from 'shiki'
import languageShellScript from '../types/ShikiBashLanguage.js'
import {theme} from '../types/ShikiTheme.js'
import languageTsx from '../types/ShikiTsxLanguage.js'

async function loadHighlighter() {
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
}

let highlighter: Promise<Highlighter>

export function transformCode(field: Expr<string>, pages: Pages<any>) {
  return pages.process(field, async code => {
    if (!code) return ''
    const {codeToHtml} = await (highlighter ||
      (highlighter = loadHighlighter()))
    return codeToHtml(code, {
      lang: code.startsWith('#') ? 'shellscript' : 'tsx'
    })
  })
}
