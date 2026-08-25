export const generatedRelease: Promise<string> = Promise.resolve().then(() => {
  const release = process.env.ALINEA_GENERATED_RELEASE
  if (!release) throw new Error('Missing generated Alinea release id')
  return release
})
