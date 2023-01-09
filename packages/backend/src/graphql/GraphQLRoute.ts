import {code} from '@alinea/core/util/CodeGen'
import {Request, Response} from '@alinea/iso'
import {ExecutionResult} from 'graphql'
import {Handle} from '../router/Router'

export function graphQLRoute(
  handler: (
    source: string,
    variables?: Record<string, any>
  ) => Promise<ExecutionResult>
): Handle<{url: URL; request: Request}, Response> {
  return async ({url, request}) => {
    const accept = request.headers.get('accept')
    if (request.method === 'GET' && accept?.includes('html')) {
      return new Response(graphiQL(url).toString(), {
        headers: {'content-type': 'text/html'}
      })
    }
    const body = await request.json()
    const result = await handler(body.query, body.variables)
    return new Response(JSON.stringify(result), {
      headers: {'content-type': 'application/json'}
    })
  }
}

function graphiQL(url: URL) {
  return code`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            height: 100%;
            margin: 0;
            width: 100%;
            overflow: hidden;
          }

          #graphiql {
            height: 100vh;
          }
        </style>
        <script
          crossorigin
          src="https://unpkg.com/react@17/umd/react.development.js"
        ></script>
        <script
          crossorigin
          src="https://unpkg.com/react-dom@17/umd/react-dom.development.js"
        ></script>
        <link rel="stylesheet" href="https://unpkg.com/graphiql/graphiql.min.css" />
      </head>

      <body>
        <div id="graphiql">Loading...</div>
        <script
          src="https://unpkg.com/graphiql/graphiql.min.js"
          type="application/javascript"
        ></script>
        <script>
          ReactDOM.render(
            React.createElement(GraphiQL, {
              fetcher: GraphiQL.createFetcher({
                url: ${JSON.stringify(url.toString())},
              }),
              defaultEditorToolsVisibility: true,
            }),
            document.getElementById('graphiql'),
          );
        </script>
      </body>
    </html>
  `
}
