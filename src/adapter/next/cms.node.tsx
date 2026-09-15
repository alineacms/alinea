import type {Config} from '#/core/Config.js'
import {generatedDatabase} from '#/backend/store/GeneratedDatabaseNode.js'
import {NextCMS} from './cms.js'

export function createCMS<Definition extends Config>(
  config: Definition
): NextCMS<Definition> {
  return new NextCMS(config, generatedDatabase)
}
