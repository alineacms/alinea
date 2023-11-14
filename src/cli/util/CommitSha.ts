export function getCommitSha(): string | undefined {
  return (
    process.env.GITHUB_SHA || // Github actions
    process.env.VERCEL_GIT_COMMIT_SHA || // Vercel
    process.env.COMMIT_REF || // Netlify
    process.env.CF_PAGES_COMMIT_SHA // Cloudflare pages
  )
}
