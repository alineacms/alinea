import {withAlinea} from 'alinea/next'

const config = withAlinea({
  serverExternalPackages: ['alinea']
})

console.log(config)

export default config
