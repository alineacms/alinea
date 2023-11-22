import '@ungap/with-resolvers'

export const withResolvers = (Promise as any).withResolvers.bind(Promise)
