"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const json_rpc_random_id_1 = __importDefault(require("json-rpc-random-id"));
const pify_1 = __importDefault(require("pify"));
const BaseBlockTracker_1 = require("./BaseBlockTracker");
const createRandomId = json_rpc_random_id_1.default();
const sec = 1000;
class PollingBlockTracker extends BaseBlockTracker_1.BaseBlockTracker {
    constructor(opts = {}) {
        this._errorCount = 0;
        // parse + validate args
        if (!opts.provider) {
            throw new Error('PollingBlockTracker - no provider specified.');
        }
        super({
            blockResetDuration: opts.pollingInterval,
        });
        // config
        this._provider = opts.provider;
        this._pollingInterval = opts.pollingInterval || 20 * sec;
        this._retryTimeout = opts.retryTimeout || this._pollingInterval / 10;
        this._keepEventLoopActive = opts.keepEventLoopActive === undefined ? true : opts.keepEventLoopActive;
        this._setSkipCacheFlag = opts.setSkipCacheFlag || false;
    }
    // trigger block polling
    async checkForLatestBlock() {
        await this._updateLatestBlock();
        return await this.getLatestBlock();
    }
    _start() {
        this._synchronize().catch((err) => this.emit('error', err));
    }
    async _synchronize() {
        while (this._isRunning) {
            try {
                await this._updateLatestBlock();
                await timeout(this._pollingInterval, !this._keepEventLoopActive);
                this._errorCount = 0;
            }
            catch (err) {
                const newErr = new Error(`PollingBlockTracker - encountered an error while attempting to update latest block:\n${err.stack}`);
                try {
                    // only emit error when the error count is > 3
                    this._errorCount++;
                    if (this._errorCount > 3) {
                        this.emit('error', newErr);
                    }
                }
                catch (emitErr) {
                    console.error(newErr);
                }
                await timeout(this._retryTimeout, !this._keepEventLoopActive);
            }
        }
    }
    async _updateLatestBlock() {
        // fetch + set latest block
        const latestBlock = await this._fetchLatestBlock();
        this._newPotentialLatest(latestBlock);
    }
    async _fetchLatestBlock() {
        const req = {
            jsonrpc: '2.0',
            id: createRandomId(),
            method: 'eth_blockNumber',
            params: [],
        };
        if (this._setSkipCacheFlag) {
            req.skipCache = true;
        }
        const res = await pify_1.default((cb) => this._provider.sendAsync(req, cb))();
        if (res.error) {
            throw new Error(`PollingBlockTracker - encountered error fetching block:\n${res.error}`);
        }
        return res.result;
    }
}
exports.PollingBlockTracker = PollingBlockTracker;
function timeout(duration, unref) {
    return new Promise((resolve) => {
        const timeoutRef = setTimeout(resolve, duration);
        // don't keep process open
        if (timeoutRef.unref && unref) {
            timeoutRef.unref();
        }
    });
}
//# sourceMappingURL=PollingBlockTracker.js.map