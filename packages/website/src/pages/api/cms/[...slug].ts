import {server} from '../../../../alinea.server'

export default server.respond

// We disable the body parser that is added by Next.js as it incorrectly parses
// application/octet-stream as string.
export const config = {api: {bodyParser: false}}
