import {Request} from '@alinea/iso'
import {Database} from 'alinea/backend/Database'
import {PreviewRequest} from './Resolver.js'
import {User} from './User.js'

export interface RequestContext {
  db: Database
  auth?: {token: string; user: User}
  preview?: PreviewRequest
  apiKey?: string
}

export interface CreateContext {
  (request: Request): Promise<RequestContext>
}

export class Driver {
  #createContext: CreateContext
  constructor(createContext: CreateContext) {
    this.#createContext = createContext
  }
}

/*
const cms = createCMS(...)

// next example
// api/cms/route.ts
import {handle} from 'alinea/next'
export const GET = handle(cms)
export const POST = handle(cms)

// cloudflare pages example
// functions/cms.ts
import {handle} from 'alinea/cloudflare'
export const onRequest = handle(cms)


function createHandler<Input>(
  getContext: (input: Input) => Promise<RequestContext>
): (input: Input) => Promise<Response> {
  return async input => {
    const context = await getContext(input)
    
  }
}

const cloudHandler = createCloudHandler(this.config, db, process.env.ALINEA_API_KEY)
function handle(cms, options) {

}
  
*/
