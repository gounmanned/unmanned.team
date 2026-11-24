const Markdown = {
    escape: (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`),

    inline(text) {
        const codes = [];
        return text
            .replace(/`([^`]+)`/g, (_, c) => `\0${codes.push(c) - 1}\0`)
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
            .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
            .replace(/\0(\d+)\0/g, (_, i) => `<code>${codes[i]}</code>`);
    },

    parse(src) {
        const lines = Markdown.escape(src).split("\n");
        const out = [];
        let group = null;

        const flush = () => {
            if (!group) return;
            const { tag, items, start } = group;
            const open = tag === "ol" && start > 1 ? `<ol start="${start}">` : `<${tag}>`;
            const inner = tag === "ul" || tag === "ol"
                ? items.map((i) => `<li>${Markdown.inline(i)}</li>`).join("")
                : items.map(Markdown.inline).join("<br>");
            out.push(`${open}${inner}</${tag}>`);
            group = null;
        };

        const add = (tag, text, start) => {
            if (group?.tag !== tag) { flush(); group = { tag, items: [], start }; }
            group.items.push(text);
        };

        // A blank line between list items ("loose" list) keeps the list going, so numbered steps don't all read 1.
        const list = { ul: /^\s*[-*+]\s+/, ol: /^\s*\d+[.)]\s+/ };
        const continues = (i) => {
            if (!list[group?.tag]) return false;
            while (i < lines.length && !lines[i].trim()) i++;
            return i < lines.length && list[group.tag].test(lines[i]);
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let m;
            if (line.startsWith("```")) {
                flush();
                const code = [];
                while (++i < lines.length && !lines[i].startsWith("```")) code.push(lines[i]);
                out.push(`<pre><code>${code.join("\n")}</code></pre>`);
            } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {   // --- or *** or ___: a divider
                flush();
                out.push("<hr>");
            } else if ((m = line.match(/^(#{1,4})\s+(.*)/))) {
                flush();
                out.push(`<h${m[1].length}>${Markdown.inline(m[2])}</h${m[1].length}>`);
            } else if ((m = line.match(/^\s*[-*+]\s+(.*)/))) add("ul", m[1]);
            else if ((m = line.match(/^\s*(\d+)[.)]\s+(.*)/))) add("ol", m[2], Number(m[1]));
            else if ((m = line.match(/^&#62;\s?(.*)/))) add("blockquote", m[1]);
            else if (line.trim()) add("p", line);
            else if (!continues(i + 1)) flush();
        }
        flush();
        return out.join("");
    },
};