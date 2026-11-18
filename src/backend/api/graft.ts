import {
  type ContentDir,
  gitRemote,
  MemorySessionLog,
  memoryRepository,
  type ReplicaEndpoint,
  type Repository
} from '@alinea/graft'
import {sqlRepository} from '@alinea/graft/sql'
import {SqlSessionLog} from '@alinea/graft/sql-session'
import {Config} from '#/core/Config.js'
import type {RequestContext} from '#/core/Connection.js'
import type {Database} from 'rado'
import {contentRoot, mediaRoot} from '#/core/graft/Roots.js'
import {GraftApi} from './GraftApi.js'

/** A git repository the content replicates to, on any host */
export interface ReplicaOptions {
  /** Unique within the project, used in ref names */
  name: string
  /** The repository's url, as git clones it over https */
  url: string
  /** `main` by default */
  branch?: string
  /**
   * Where content sits in the repository: the project's content directory
   * and media directory by default
   */
  contentDir?: ContentDir
  /**
   * `two-way` brings in what developers push as well, `mirror` only receives
   * the content. A two-way replica is where the content is imported from
   * when the store has none.
   */
  direction?: 'two-way' | 'mirror'
  /** A token with write access, sent as git's password */
  token?: string
  /** Saves wait until this repository accepted them */
  strict?: boolean
}

export interface GraftBackendOptions {
  /** The database holding the content, in memory without one */
  database?: Database
  replicas?: Array<ReplicaOptions>
  /** The secret of the push webhook, `?action=replicate&secret=` */
  webhookSecret?: string
  /** Lets editors edit entries together, live */
  sessions?: boolean
}

/**
 * Keeps the content in the project's database as git does: saves are
 * commits, merged when made from an older state, and replicas are git
 * repositories on any host.
 */
export function graft(
  options: GraftBackendOptions = {}
): (context: RequestContext, config: Config) => GraftApi {
  let api: GraftApi | undefined
  // One store per process: its handlers count held requests and passes
  return (_context, config) => {
    api ??= new GraftApi({
      repo: repository(options.database),
      config,
      replicas: (options.replicas ?? []).map(replica =>
        endpoint(config, replica)
      ),
      webhookSecret: options.webhookSecret,
      sessions: options.sessions
        ? options.database
          ? new SqlSessionLog(options.database)
          : new MemorySessionLog()
        : undefined
    })
    return api
  }
}

function repository(database: Database | undefined): Repository {
  return database ? sqlRepository(database) : memoryRepository()
}

function endpoint(config: Config, options: ReplicaOptions): ReplicaEndpoint {
  const branch = options.branch ?? 'main'
  const mediaDir = Config.mainWorkspace(config).mediaDir
  const contentDir = options.contentDir ?? {
    [contentRoot]: Config.contentDir(config),
    ...(mediaDir ? {[mediaRoot]: mediaDir} : {})
  }
  const headers: Record<string, string> = {}
  if (options.token)
    headers.authorization = `Basic ${btoa(`x-access-token:${options.token}`)}`
  return {
    replica: {
      name: options.name,
      branch: branch.startsWith('refs/') ? branch : `refs/heads/${branch}`,
      contentDir,
      direction: options.direction ?? 'two-way',
      strict: options.strict
    },
    remote: gitRemote({url: options.url, headers})
  }
}
