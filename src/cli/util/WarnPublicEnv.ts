const mockProcess = {
  env: new Proxy(
    {},
    {
      get(target, key: string) {
        if (key !== 'ALINEA_BASE_URL')
          console.warn(
            `process.env.${key} is not defined on the client. If this variable ` +
              `is required in the browser, prefix the variable with PUBLIC_ ` +
              `and restart alinea.`
          )
      }
    }
  )
}

export {mockProcess as process}
