class SignalSidebar {
    constructor(state) {
        this.state = state;
    }

    reset(){
        document.getElementById("updates").innerHTML = "";
    }

    reload(signal, updates) {
        this.signal = signal;

        document.getElementById("signal-severity").value = signal.severity;
        document.getElementById("signal-status").value = signal.status;

        const banner = document.getElementById("severity-banner");
        banner.dataset.severity = signal.severity;
        banner.innerHTML = `<span>${Workspace.SEVERITY[signal.severity]}</span>`;
        this.add(signal);

        updates.sort((a, b) => new Date(a.updated) - new Date(b.updated)).forEach((update, _) => {
            this.add(update);
        });
    }

    add(update){
        if (document.querySelector(`#updates li[data-key="${update.key}"]`)) return;

        const message = document.createElement("li");
        message.dataset.key = update.key;
        message.className = "";

        const source = update.source || this.signal.source;
        message.innerHTML = `
            <div class="message-row">
                <div class="avatar"><img class="message-avatar" src="${Workspace.avatar(source)}" /></div>
                <div class="message-content">
                    <div class="header">
                        <div class="sender">${source}</div>
                        <div class="timestamp">${update.updated}</div>
                    </div>
                    <div class="body">${update.value}</div>
                </div>
            </div>
        `;

        document.getElementById("updates").appendChild(message);
        document.getElementById("response").value = "";
        const last = document.getElementById("updates").querySelector('li:last-child');
        last.scrollIntoView({ behavior: 'smooth' });
    }
}