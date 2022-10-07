function chain(target, queue = []) {
  return new Proxy(target, {
    get(target, method) {
      switch (method) {
        case 'catch':
        case 'then':
          return (...args) => {
            return target.then(({pages}) => {
              let current = pages
              for (const [method, args] of queue) {
                current = current[method](...args)
              }
              return current[method](...args)
            })
          }
        default:
          return (...args) => {
            return chain(target, [...queue, [method, args]])
          }
      }
    }
  })
}

exports.initPages = (...args) => {
  return chain(
    import('./pages.js').then(({initPages}) => {
      return {pages: initPages(...args)}
    })
  )
}
