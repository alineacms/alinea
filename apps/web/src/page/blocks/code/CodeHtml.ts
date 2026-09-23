export interface CodeHtmlClasses {
  pre: string
  code: string
  line: string
}

// Shiki renders `<pre class="shiki" style="..."><code><span class="line">`,
// swap in our own module classes so the markup can be styled without
// targeting the generated tags
export function withCodeClasses(html: string, classes: CodeHtmlClasses) {
  return html
    .replace(/<pre class="shiki"[^>]*>/, `<pre class="${classes.pre}">`)
    .replace('<code>', `<code class="${classes.code}">`)
    .replaceAll('<span class="line">', `<span class="${classes.line}">`)
}
