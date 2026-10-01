export function mcpInstructions(rootDir: string): string {
  return `Alinea is a git-based CMS, every entry is a JSON file in the content directory of ${rootDir}. Change content with these tools rather than editing the files: they generate ids, order keys and rich text nodes, validate like the dashboard and an open dashboard updates live.

1. describe_schema: workspaces, roots, types, their fields and how to write each value.
2. find_entries / get_entry to find entries, parents and ids.
3. create_entry / update_entry with data keyed by field name. Rich text is Markdown, links are entry ids. upload_file first to get a media id for image and file fields.
4. Writes publish, pass publish: false for a draft when drafts are enabled.
5. get_entry lists the entries linking to an entry, check them before deleting or moving it.
Errors name the field and what is expected, fix the input and retry.`
}
