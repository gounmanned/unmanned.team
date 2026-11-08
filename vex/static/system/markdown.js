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
            const { tag, items } = group;
            const inner = tag === "ul" || tag === "ol"
                ? items.map((i) => `<li>${Markdown.inline(i)}</li>`).join("")
                : items.map(Markdown.inline).join("<br>");
            out.push(`<${tag}>${inner}</${tag}>`);
            group = null;
        };

        const add = (tag, text) => {
            if (group?.tag !== tag) { flush(); group = { tag, items: [] }; }
            group.items.push(text);
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let m;
            if (line.startsWith("```")) {
                flush();
                const code = [];
                while (++i < lines.length && !lines[i].startsWith("```")) code.push(lines[i]);
                out.push(`<pre><code>${code.join("\n")}</code></pre>`);
            } else if ((m = line.match(/^(#{1,4})\s+(.*)/))) {
                flush();
                out.push(`<h${m[1].length}>${Markdown.inline(m[2])}</h${m[1].length}>`);
            } else if ((m = line.match(/^\s*[-*+]\s+(.*)/))) add("ul", m[1]);
            else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) add("ol", m[1]);
            else if ((m = line.match(/^&#62;\s?(.*)/))) add("blockquote", m[1]);
            else if (line.trim()) add("p", line);
            else flush();
        }
        flush();
        return out.join("");
    },
};