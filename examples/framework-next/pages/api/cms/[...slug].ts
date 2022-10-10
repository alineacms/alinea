// The nodeHandler utility exports the backend handle as a Node.js http handler
import {nodeHandler} from '@alinea/backend/router/NodeHandler'
// The generated backend file will connect to the backend we'll configure next
import {backend} from '@alinea/content/backend'
// Handle cms API routes at /api/cms/[...slug]
export default nodeHandler(backend.handle)
// Disable the body parser middleware that next.js injects,
// we'll let the handler deal with it
export const config = {api: {bodyParser: false}}
