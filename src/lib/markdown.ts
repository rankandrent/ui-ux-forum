import MarkdownIt from "markdown-it";

// Raw HTML is disabled, so user input can never inject tags or attributes.
// markdown-it's validateLink() already rejects javascript:, vbscript:, file: and data: URLs.
const md = new MarkdownIt({ html: false, linkify: true, typographer: false, breaks: false });

md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  const token = tokens[idx];
  const href = String(token.attrGet("href") ?? "");
  if (/^https?:\/\//i.test(href)) {
    token.attrSet("rel", "ugc nofollow noopener");
    token.attrSet("target", "_blank");
  }
  return self.renderToken(tokens, idx, options);
};

md.renderer.rules.image = (tokens, idx) => {
  const token = tokens[idx];
  const src = String(token.attrGet("src") ?? "");
  const alt = md.utils.escapeHtml(token.content);
  if (!/^https:\/\//i.test(src)) return alt;
  return `<img src="${md.utils.escapeHtml(src)}" alt="${alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
};

// The page owns <h1>/<h2>; demote user headings so the outline stays clean.
md.core.ruler.push("demote_headings", (state) => {
  for (const token of state.tokens) {
    if (token.type === "heading_open" || token.type === "heading_close") {
      const level = Math.min(6, Math.max(3, Number(token.tag.slice(1)) + 2));
      token.tag = `h${level}`;
    }
  }
});

export function renderMarkdown(source: string): string {
  return md.render(source);
}

/** Plain-text excerpt for meta descriptions and schema. */
export function excerpt(source: string, max = 160): string {
  const text = source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
