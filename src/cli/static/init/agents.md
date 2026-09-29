## Alinea

This project uses Alinea, a Git-based headless CMS. The schema and workspaces
are configured in `{cmsFile}`, content is stored as JSON files in `content/`.

- Docs: `node_modules/alinea/docs/` holds the documentation that matches the
  installed version, start at `index.md`. Prefer it over what you remember.
- Content changes: `alinea dev` runs an MCP server at the URL it prints
  (default http://localhost:4500/mcp). Prefer its tools to create, edit and
  publish entries, they validate content and keep the dashboard in sync.
- Without the MCP server, edit the content JSON files as the docs describe.
- Never edit generated files: `public/admin.html`, `public/admin/` and
  `@alinea/generated`.
