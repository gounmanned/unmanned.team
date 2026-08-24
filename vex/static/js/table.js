class Table {
    constructor(id){
        const table = document.getElementById(id);
        this.body = table.querySelector('tbody');
    }

    clear(){
        this.body.innerHTML = '';
    }

    watermark(show) {
        const wrap = document.getElementById('signal-table-wrap');
        if (wrap) wrap.classList.toggle('empty', show);
    }

    add(row, signal) {
        const label = Workspace.SEVERITY[signal.severity];
        row.querySelector("td.severity").innerHTML = `<span class="severity-chip" data-severity="${signal.severity}">${label}</span>`;
        row.dataset.status = signal.status;
        row.dataset.severity = signal.severity;
        row.dataset.updated = signal.updated;

        const closed = signal.status.startsWith("C");
        const unread = !closed && !signal.read;

        row.classList.toggle("closed", closed);
        row.classList.toggle("unread", unread);

        if (closed) {
            this.body.appendChild(row);
            return;
        }

        const anchor = [...this.body.children]
            .filter(r => !r.classList.contains("closed"))
            .find(r => {
                const rUnread = r.classList.contains("unread");
                return unread !== rUnread ? !rUnread : new Date(r.dataset.updated) < new Date(signal.updated);
            });

        this.body.insertBefore(row, anchor ?? this.body.querySelector(".closed") ?? null);
    }
}