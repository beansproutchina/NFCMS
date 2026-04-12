/**
 * HookManager.ts
 * Provides WordPress-style action and filter hooks.
 */

export class HookManager {
    constructor() {
        /** @private @type {Map<string, Array<{ priority: number, callback: Function }>>} */
        this.actions = new Map();
        
        /** @private @type {Map<string, Array<{ priority: number, callback: Function }>>} */
        this.filters = new Map();
    }

    /**
     * Add an action listener.
     * @param {string} hookName
     * @param {Function} callback
     * @param {number} [priority=10]
     */
    addAction(hookName, callback, priority = 10) {
        if (!this.actions.has(hookName)) {
            this.actions.set(hookName, []);
        }
        this.actions.get(hookName).push({ priority, callback });
        this.actions.get(hookName).sort((a, b) => a.priority - b.priority);
    }

    /**
     * Trigger an action.
     * @param {string} hookName
     * @param {...any} args
     */
    async doAction(hookName, ...args) {
        const hooks = this.actions.get(hookName) || [];
        for (const hook of hooks) {
            await hook.callback(...args);
        }
    }

    /**
     * Add a filter listener.
     * @param {string} hookName
     * @param {Function} callback
     * @param {number} [priority=10]
     */
    addFilter(hookName, callback, priority = 10) {
        if (!this.filters.has(hookName)) {
            this.filters.set(hookName, []);
        }
        this.filters.get(hookName).push({ priority, callback });
        this.filters.get(hookName).sort((a, b) => a.priority - b.priority);
    }

    /**
     * Apply all filters to modify a value.
     * @param {string} hookName
     * @param {any} value
     * @param {...any} args
     * @returns {Promise<any>}
     */
    async applyFilters(hookName, value, ...args) {
        const hooks = this.filters.get(hookName) || [];
        for (const hook of hooks) {
            value = await hook.callback(value, ...args);
        }
        return value;
    }
}

export const hooks = new HookManager();
