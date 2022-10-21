exports.createStore = (...args) => {
  return import('./store.js').then(({createStore}) => createStore(...args))
}
