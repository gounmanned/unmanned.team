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
        const unread = !signal.read && !closed;
        row.classList.toggle("unread", unread);
        row.classList.toggle("closed", closed);

        if (closed) {
            this.body.appendChild(row);
            return;
        }

        const open = [...this.body.children].filter(r => r !== row && !r.classList.contains("closed"));
        const anchor = open.find(r => {
            const rUnread = r.classList.contains("unread");
            if (unread !== rUnread) return unread;
            return new Date(r.dataset.updated) < new Date(signal.updated);
        });

        this.body.insertBefore(row, anchor ?? this.body.querySelector(".closed") ?? null);
    }    
}