const mockProcess = {
  env: new Proxy(
    {},
    {
      get(target, key: string) {
        console.warn(
          `process.env.${key} is not defined on the client. If this variable is required in the browser, prefix the variable with PUBLIC_ and restart Alinea.`
        )
      }
    }
  )
}

export {mockProcess as process}
