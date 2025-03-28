export function joinPaths(...paths: Array<string | undefined>) {
  return paths
    .filter(Boolean)
    .map((part, i) => {
      let start = 0
      let end = undefined
      if (i < paths.length - 1 && part!.endsWith('/')) end = -1
      if (i > 0 && part!.startsWith('/')) start = 1
      return part!.slice(start, end)
    })
    .join('/')
}
