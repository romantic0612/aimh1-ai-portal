function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || "").replace(/&amp;/g, "&"), window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function inlineMarkdown(value) {
  let text = escapeHtml(value);
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, href) => {
    const url = safeUrl(href.trim());
    return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>` : match;
  });
  text = text.replace(/(^|[\s(（:：])((https?:\/\/[^\s<>"']+))/gi, (match, prefix, href) => {
    let clean = href;
    while (/[)，。；！？、,.!?;:]+$/.test(clean)) clean = clean.slice(0, -1);
    const tail = href.slice(clean.length);
    const url = safeUrl(clean);
    if (!url) return match;
    const label = url.length > 52 ? "打开链接" : url;
    return `${prefix}<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>${escapeHtml(tail)}`;
  });
  return text;
}

function normalizeDifyMarkdown(value) {
  return String(value || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\/?think>/gi, "")
    .replace(/^\s*已深度思考.*$/gmi, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(^|\n)(#{1,6})([^\s#\n])/g, "$1$2 $3")
    .replace(/([:：])\s*-\s*(?=\[|\S{1,30}[:：])/g, "$1\n\n- ")
    .replace(/\)\s*-\s*(?=\[)/g, ")\n- ")
    .trim();
}

function renderTable(lines) {
  if (lines.length < 2 || !/\|/.test(lines[0]) || !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[1])) {
    return "";
  }
  const headers = lines[0].replace(/^\||\|$/g, "").split("|").map(inlineMarkdown);
  const rows = lines.slice(2).map((line) => line.replace(/^\||\|$/g, "").split("|").map(inlineMarkdown));
  return `<table><thead><tr>${headers.map((item) => `<th>${item.trim()}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_, index) => `<td>${(row[index] || "").trim()}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

export function renderMarkdown(value) {
  const text = normalizeDifyMarkdown(value);
  if (!text) return "";

  const codeBlocks = [];
  let prepared = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    const token = `@@CODE${codeBlocks.length}@@`;
    codeBlocks.push(`<pre><code>${escapeHtml(code.replace(/\n$/, ""))}</code></pre>`);
    return token;
  });

  const blocks = prepared.split(/\n{2,}/);
  const html = blocks.map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    if (/^@@CODE\d+@@$/.test(trimmed)) return trimmed;
    const lines = trimmed.split("\n").map((line) => line.trim()).filter(Boolean);
    const table = renderTable(lines);
    if (table) return table;
    if (lines.length === 1 && /^(#{1,6})\s+/.test(lines[0])) {
      const [, hashes, title] = lines[0].match(/^(#{1,6})\s+(.+)$/);
      return `<h${hashes.length}>${inlineMarkdown(title)}</h${hashes.length}>`;
    }
    if (lines.every((line) => /^[-*+]\s+/.test(line))) {
      return `<ul>${lines.map((line) => `<li>${inlineMarkdown(line.replace(/^[-*+]\s+/, ""))}</li>`).join("")}</ul>`;
    }
    if (lines.every((line) => /^\d+[.)]\s+/.test(line))) {
      return `<ol>${lines.map((line) => `<li>${inlineMarkdown(line.replace(/^\d+[.)]\s+/, ""))}</li>`).join("")}</ol>`;
    }
    if (lines.every((line) => /^>\s?/.test(line))) {
      return `<blockquote>${lines.map((line) => inlineMarkdown(line.replace(/^>\s?/, ""))).join("<br>")}</blockquote>`;
    }
    return `<p>${lines.map(inlineMarkdown).join("<br>")}</p>`;
  }).join("");

  return codeBlocks.reduce((acc, block, index) => acc.replace(`@@CODE${index}@@`, block), html);
}
