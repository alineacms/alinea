import react from '@vitejs/plugin-react'
import {writeFileSync} from 'node:fs'
import {basename} from 'node:path'
import {defineConfig} from 'vite-plus'
import {alineaFixturePlugin} from './src/v2/plugins/alineaFixturePlugin.js'

function generateScopedName(name: string, fileName: string) {
  const base = basename(fileName)
  const module = base.slice(0, base.indexOf('.'))
  if (name.startsWith('root-')) name = name.slice(5)
  if (name.startsWith('root')) name = name.slice(4)
  return `alinea-${module}${name ? '-' + name : ''}`
}

function pkg(name: string) {
  return new RegExp(`^${RegExp.escape(name)}(/|$)`)
}

export default defineConfig({
  plugins: [alineaFixturePlugin(), react()],
  resolve: {tsconfigPaths: true},
  css: {modules: {generateScopedName}},
  pack: {
    format: ['esm'],
    outExtensions() {
      return {js: '.js', dts: '.d.ts'}
    },
    entry: [
      'src/index.ts',
      'src/cli.ts',
      'src/config.ts',
      'src/core.ts',
      // 'src/dashboard.ts',
      'src/edit.ts',
      'src/field.ts',
      'src/next.ts',
      'src/query.ts'
      // 'src/ui.ts'
    ],
    dts: true,
    clean: true,
    minify: false,
    deps: {
      neverBundle: [
        'fs-extra',
        '@alinea/iso',
        '@alinea/generated',
        'next',
        'react',
        'sharp',
        'react',
        'react-dom',
        'esbuild'
      ].map(pkg)
    },
    outputOptions: {
      preserveModules: true,
      preserveModulesRoot: 'src'
    },
    css: {
      fileName: 'index.css',
      minify: false,
      transformer: 'postcss',
      modules: {generateScopedName}
    },
    onSuccess() {
      // rolldown/rolldown#7874
      writeFileSync(
        'dist/index.js',
        [
          "export * as Config from './config.js'",
          "export * as Edit from './edit.js'",
          "export * as Field from './field.js'",
          "export * as Query from './query.js'"
        ].join('\n')
      )
    }
  }
})
