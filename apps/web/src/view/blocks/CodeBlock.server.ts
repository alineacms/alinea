import type {Pages} from '@alinea/backend'
import {Expr} from '@alinea/store'
import {getHighlighter} from 'shiki'
import {theme} from '../types/ShikiTheme'
import {language} from '../types/ShikiTsxLanguage'

const highlighter = getHighlighter({
  theme: {
    ...theme,
    type: 'light',
    settings: [],
    fg: '#1E232A',
    bg: 'white',
    colors: {...theme.colors, 'editor.background': '#1E232A'}
  },
  langs: [{id: 'tsx', scopeName: 'source.tsx', grammar: language}]
})

export function transformCode(field: Expr<string>, pages: Pages<any>) {
  return pages.process(field, async code => {
    if (!code) return ''
    const {codeToHtml} = await highlighter
    return codeToHtml(code, {lang: 'tsx'})
  })
}
