(function () {
  "use strict";

  const PLACEHOLDER_PREFIX = "\uE000MD";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[ch]);
  }

  function customUrlTransform(value) {
    const uri = String(value || "").replace(/&amp;/g, "&").trim();
    if (!uri) return "";
    if (uri.startsWith("#")) return uri;
    if (uri.startsWith("//")) return uri;

    const colonIndex = uri.indexOf(":");
    if (colonIndex === -1) return uri;

    const slashIndex = uri.indexOf("/");
    const questionMarkIndex = uri.indexOf("?");
    const hashIndex = uri.indexOf("#");
    if (
      (slashIndex !== -1 && colonIndex > slashIndex) ||
      (questionMarkIndex !== -1 && colonIndex > questionMarkIndex) ||
      (hashIndex !== -1 && colonIndex > hashIndex)
    ) {
      return uri;
    }

    const scheme = uri.substring(0, colonIndex + 1).toLowerCase();
    return /^(https?|ircs?|mailto|xmpp|abbr):$/i.test(scheme) ? uri : "";
  }

  function safeUrl(value) {
    const uri = customUrlTransform(value);
    if (!uri) return "";
    if (uri.startsWith("#") || uri.startsWith("/") || uri.startsWith("./") || uri.startsWith("../"))
      return uri;
    if (uri.startsWith("//"))
      return `${window.location.protocol || "https:"}${uri}`;
    if (!uri.includes(":"))
      return uri;
    try {
      const url = new URL(uri, window.location.origin);
      return url.href;
    } catch {
      return /^(abbr|irc|ircs|xmpp|mailto):/i.test(uri) ? uri : "";
    }
  }

  function preserveBackslashContent(content) {
    const text = String(content || "");
    const trimmed = text.trim();
    if (/^\\\\\S.*/.test(trimmed) && !/^`[\s\S]*`$/.test(trimmed))
      return `\`${text}\``;
    return text;
  }

  function preprocess(content) {
    let text = String(content || "");
    text = text
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/<\/?think>/gi, "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/^\s*已深度思考.*$/gmi, "")
      .replace(/教务智能体类|闲聊类|图书馆智能体类|人事智能体类/g, "")
      .replace(/\r\n?/g, "\n")
      .replace(/^\s*#{1,6}\s*$/gm, "")
      .replace(/^\s*[*]\s*$/gm, "")
      .replace(/^\s*[-－]\s*$/gm, "")
      .replace(/([^\n])(?=#{1,6}[^\s#\n])/g, "$1\n\n")
      .replace(/(^|\n)(#{1,6})([^\s#\n])/g, "$1$2 $3")
      .replace(/(#{1,6}\s*关于[^\n#。；，,]*?情况说明)(?=\S)/g, "$1\n\n")
      .replace(/(#{1,6}\s*(?:出现原因|系统默认机制|解决方案|正常情况|异常情况|处理方式|解决办法|注意事项|成绩统计范围|成绩计算规则|更多详细信息))(?=\S)/g, "$1\n\n")
      .replace(/([^\n])-(?=(?:正常情况|异常情况|解决方案|注意|若|课程|统计时间|课程范围|成绩认定|补考|旷考|实验课))/g, "$1\n- ")
      .replace(/(^|\n)-(?=\S)/g, "$1- ")
      .replace(/(^|\n)([^\s:：#\-*+][^:：\n]{1,16})\n\s*[:：]\s*([^\n]+)/g, "$1- **$2**：$3")
      .replace(/([^\n])(?=(?:[-*+]\s+|\d+[.)]\s+))/g, "$1\n");

    const lines = text.split("\n").map((line) => {
      let current = line.trimEnd();
      current = current.replace(/^\s*#{1,6}\s*$/u, "");
      current = current.replace(/^\s*[-－]\s*$/u, "");
      current = current.replace(/^#{1,6}\s+([一二三四五六七八九十]+[、.．])\s*(成绩统计范围|成绩计算规则|注意事项|更多详细信息|加权平均成绩计算方法)(\S.+)$/u, "### $1 $2\n\n$3");
      current = current.replace(/^#{1,6}\s+([一二三四五六七八九十]+[、.．])\s*(.+?)\s*[-－]\s*$/u, "### $1 $2");
      current = current.replace(/^#{1,6}\s+([一二三四五六七八九十]+[、.．])\s+(.+)$/u, "### $1 $2");
      current = current.replace(/^#{1,6}\s*(辅修课程|实验课成绩|计算次数|课程范围|统计时间|成绩认定|补考和重修成绩|旷考处理)\s*[-－]?\s*$/u, "#### $1");
      current = current.replace(/^([一二三四五六七八九十]+[、.．])\s*(成绩统计范围|成绩计算规则|注意事项|更多详细信息|加权平均成绩计算方法)(\S.+)$/u, "### $1 $2\n\n$3");
      current = current.replace(/^([一二三四五六七八九十]+[、.．])\s*(.+?)\s*[-－]\s*$/u, "### $1 $2");
      current = current.replace(/^([一二三四五六七八九十]+[、.．])\s+(.+)$/u, "### $1 $2");
      current = current.replace(/^(辅修课程|实验课成绩|计算次数|课程范围|统计时间|成绩认定|补考和重修成绩|旷考处理)\s*[-－]\s*$/u, "#### $1");
      current = current.replace(/^\*(\S.*)$/u, "$1");
      current = current.replace(/^([^\s:：#\-*+][^:：\n]{1,16})\s*[:：]\s*(.+)$/u, "- **$1**：$2");
      current = current.replace(/^(-\s+.+?)[-－]\s*$/u, "$1");
      return current;
    });

    return lines.join("\n")
      .replace(/(^|\n)(#{1,6}\s+[^\n]+)\n(?=\S)/g, "$1$2\n\n")
      .replace(/(^|\n)(###\s+[一二三四五六七八九十]+[、.．]\s+[^\n]+)\n(?=\S)/g, "$1$2\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function stashFactory() {
    const values = [];
    return {
      put(html) {
        const token = `${PLACEHOLDER_PREFIX}${values.length}\uE001`;
        values.push(html);
        return token;
      },
      restore(html) {
        return html.replace(new RegExp(`${PLACEHOLDER_PREFIX}(\\d+)\\uE001`, "g"), (_m, index) => values[Number(index)] || "");
      }
    };
  }

  function inlineMarkdown(value) {
    const stash = stashFactory();
    let text = escapeHtml(value);

    text = text.replace(/`([^`\n]+)`/g, (_m, code) => stash.put(`<code>${escapeHtml(code)}</code>`));
    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, alt, href) => {
      const url = safeUrl(href);
      return url ? stash.put(`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="chat-image" loading="lazy" />`) : escapeHtml(match);
    });
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, href) => {
      const url = safeUrl(href);
      return url ? stash.put(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${inlineMarkdown(label)}</a>`) : escapeHtml(match);
    });
    text = text.replace(/(^|[\s(（])((https?:\/\/[^\s<>"']+))/gi, (match, prefix, rawUrl) => {
      let urlText = rawUrl;
      while (/[)，。；！？、,.!?;:]+$/.test(urlText))
        urlText = urlText.slice(0, -1);
      const suffix = rawUrl.slice(urlText.length);
      const url = safeUrl(urlText);
      if (!url) return match;
      const imageLike = /\.(png|jpe?g|gif|bmp|webp|svg)(\?.*)?$/i.test(url) || /\/file-preview(?:[?#]|$)/i.test(url);
      const html = imageLike
        ? `<img src="${escapeHtml(url)}" alt="图片" class="chat-image" loading="lazy" />`
        : `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(urlText)}</a>`;
      return `${prefix}${stash.put(html)}${escapeHtml(suffix)}`;
    });
    text = text.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
    text = text.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
    text = text.replace(/(^|[^\*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

    return stash.restore(text);
  }

  function splitBlocks(markdown) {
    const blocks = [];
    const lines = markdown.split("\n");
    let buffer = [];
    let fence = null;

    const flush = () => {
      if (buffer.length) {
        blocks.push(buffer.join("\n"));
        buffer = [];
      }
    };

    for (const line of lines) {
      const fenceMatch = line.match(/^```(\w+)?\s*$/);
      if (fenceMatch) {
        if (fence) {
          buffer.push(line);
          blocks.push(buffer.join("\n"));
          buffer = [];
          fence = null;
        } else {
          flush();
          fence = fenceMatch[1] || "";
          buffer.push(line);
        }
        continue;
      }

      if (fence) {
        buffer.push(line);
        continue;
      }

      if (!line.trim()) {
        flush();
        continue;
      }

      buffer.push(line);
    }
    flush();
    return blocks;
  }

  function renderTable(lines) {
    if (lines.length < 2 || !/\|/.test(lines[0])) return "";
    if (!/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[1])) return "";
    const split = (line) => line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
    const headers = split(lines[0]);
    const rows = lines.slice(2).map(split);
    return [
      "<table><thead><tr>",
      headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join(""),
      "</tr></thead><tbody>",
      rows.map((row) => `<tr>${headers.map((_h, index) => `<td>${inlineMarkdown(row[index] || "")}</td>`).join("")}</tr>`).join(""),
      "</tbody></table>"
    ].join("");
  }

  function renderBlock(block) {
    const trimmed = block.trim();
    if (!trimmed) return "";

    const fence = trimmed.match(/^```(\w+)?\n([\s\S]*?)```$/);
    if (fence)
      return `<pre><code>${escapeHtml(fence[2].replace(/\n$/, ""))}</code></pre>`;

    if (/^(?:---|\*\*\*|___)$/.test(trimmed))
      return "<hr>";

    const lines = trimmed.split("\n").map((line) => line.trim()).filter(Boolean);
    const table = renderTable(lines);
    if (table) return table;

    if (lines.every((line) => /^>\s?/.test(line)))
      return `<blockquote>${lines.map((line) => inlineMarkdown(line.replace(/^>\s?/, ""))).join("<br>")}</blockquote>`;

    if (lines.every((line) => /^[-*+]\s+/.test(line) || /^[•·]\s*/.test(line)))
      return `<ul>${lines.map((line) => `<li>${inlineMarkdown(line.replace(/^[-*+]\s+/, "").replace(/^[•·]\s*/, ""))}</li>`).join("")}</ul>`;

    if (lines.every((line) => /^\d+[.)]\s+/.test(line)))
      return `<ol>${lines.map((line) => `<li>${inlineMarkdown(line.replace(/^\d+[.)]\s+/, ""))}</li>`).join("")}</ol>`;

    if (lines.length === 1) {
      const heading = lines[0].match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        const level = Math.min(4, Math.max(2, heading[1].length));
        return `<h${level}>${inlineMarkdown(heading[2])}</h${level}>`;
      }
      const chineseHeading = lines[0].match(/^([一二三四五六七八九十]+[、.．])\s*(.+)$/u);
      if (chineseHeading)
        return `<h3>${inlineMarkdown(`${chineseHeading[1]} ${chineseHeading[2]}`)}</h3>`;
    }

    return `<p>${lines.map(inlineMarkdown).join("<br>")}</p>`;
  }

  window.renderCampusMarkdown = function renderCampusMarkdown(content) {
    const markdown = preprocess(preserveBackslashContent(content));
    if (!markdown) return "";
    return splitBlocks(markdown).map(renderBlock).filter(Boolean).join("")
      .replace(/<\/ul><ul>/g, "")
      .replace(/<\/ol><ol>/g, "");
  };
})();
