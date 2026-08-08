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
        row.classList.toggle("closed", closed);
        if (closed) {
            this.body.appendChild(row);
            return;
        }

        const rows = [...this.body.children];
        const before = rows.find(existing =>
            new Date(existing.dataset.updated) < new Date(signal.updated)
        );

        if (before) {
            this.body.insertBefore(row, before);
        } else {
            this.body.appendChild(row);
        }
    }
}