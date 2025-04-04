const ignore = new Set(['FORCE_COLOR', 'NODE_ENV'])

const mockProcess = {
  env: new Proxy(
    {},
    {
      get(target: any, key: string) {
        if (ignore.has(key)) return
        console.warn(
          `process.env.${key} is not defined on the client. If this variable is required in the browser, prefix the variable with PUBLIC_ and restart Alinea.`
        )
      }
    }
  )
}

export {mockProcess as process}
