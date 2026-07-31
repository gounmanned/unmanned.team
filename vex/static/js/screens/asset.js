class AssetScreen {
    constructor(state) {
        this.state = state;
        this.api = new AssetApi();
    }

    async reset() {
        this.api.set("account", this.state.account());
    }

    async reload() {

    }
}