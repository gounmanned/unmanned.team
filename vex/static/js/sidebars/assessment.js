class AssessmentSidebar {
    static ROOT = 'assessment';
    static FILE = 'daily.md';

    constructor(state) {
        this.state = state;
        this.api = state.api;
        this.wrap = document.getElementById('assessment-wrap');
        this.body = document.getElementById('assessment-body');
    }

    reset() {
        this.body.innerHTML = '';
        this.wrap.classList.add('empty');
    }

    async reload() {
        this.api.file.root = `${AssessmentSidebar.ROOT}/`;
        const assessment = await this.fetch(AssessmentSidebar.FILE);
        this.body.innerHTML = Markdown.parse(assessment ?? '');
        this.wrap.classList.toggle('empty', !this.body.children.length);
    }

    async fetch(name) {
        const redirect = await this.api.file.call('GET', `file/${AssessmentSidebar.ROOT}?name=${encodeURIComponent(name)}`);
        if (!redirect) return null;

        const response = await fetch(redirect.url);
        return response.ok ? response.text() : null;
    }

    async browse() {
        const loader = SiteSpinner.cover(this.wrap);
        await this.reload();
        loader.remove();
    }
}