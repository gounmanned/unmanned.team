class Sidebar {
  constructor(id){ this.id = id; }
  _open(){ document.getElementById(this.id).show(); }
  close(){ document.getElementById(this.id).hide(); }
  set(key){ this.key = key; }
}

class SignalSidebar extends Sidebar {

  static SEVERITY = {
      1: { label: "Critical" },
      2: { label: "High" },
      3: { label: "Medium" },
      4: { label: "Low" },
      5: { label: "Info" },
  };

  constructor(id){
    super(id);
  }

  open(signal, updates) {
    this._open();
    this.signal = signal;

    document.getElementById("updates").innerHTML = "";
    document.getElementById("signal-severity").value = signal.severity;
    document.getElementById("signal-status").value = signal.status;

    const meta = SignalSidebar.SEVERITY[signal.severity];
    const banner = document.getElementById("severity-banner");
    banner.dataset.severity = signal.severity;
    banner.innerHTML = `<img class="banner-icon" src="static/img/severity/${signal.severity}.svg"/><span>${meta.label}</span>`;
    
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

    const user = update.user || this.signal.source;
    message.innerHTML = `
        <div class="message-row">
            <div class="avatar"><img class="message-avatar" src="${Workspace.avatar(user)}" /></div>
            <div class="message-content">
                <div class="header">
                    <div class="sender">${user}</div>
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