import react from '@vitejs/plugin-react'
import {writeFileSync} from 'node:fs'
import {defineConfig} from 'vite-plus'
import {alineaFixturePlugin} from './src/v2/plugins/alineaFixturePlugin.js'

const generateScopedName = 'alinea-[local]'

export default defineConfig({
  plugins: [alineaFixturePlugin(), react() /*, alineaPlugin('apps/dev')*/],
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

function pkg(name: string) {
  return new RegExp(`^${RegExp.escape(name)}(/|$)`)
}
