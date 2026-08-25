/**
 * 预渲染任务队列:去重 + 串行 + 容错。
 *
 * 为什么必须有它:`HookManager.doAction` 是**串行 await** 的,预渲染直接跑在 hook 里会把发布
 * 请求阻塞一两秒。hook 只 `enqueue()` 立即返回,队列在后台消费。
 *
 * 三件事各自的理由:
 * - **去重**:连发三篇文章会触发三次「重生成首页」。合并窗口内同一 key 只跑一次。
 * - **串行**:同时只开一个 chromium page。并发开页在小内存机器上会直接把容器打爆。
 * - **容错**:一页生成失败不能让队列停摆,更不能冒泡到发布请求上(S14)。
 */
export interface PrerenderQueueOptions {
    run(key: string): Promise<void>;
    /** 合并窗口(ms):窗口内同一 key 重复入队只跑一次。 */
    debounceMs?: number;
    onError?(key: string, err: unknown): void;
}

export class PrerenderQueue {
    private readonly opts: Required<Pick<PrerenderQueueOptions, "run" | "debounceMs">> &
        Pick<PrerenderQueueOptions, "onError">;
    /** 待跑的 key。用 Set 天然去重,插入序即消费序。 */
    private pending = new Set<string>();
    private timer: ReturnType<typeof setTimeout> | null = null;
    private draining = false;
    /** 队列排空时要 resolve 的等待者(测试与优雅停机用)。 */
    private idleWaiters: Array<() => void> = [];

    constructor(opts: PrerenderQueueOptions) {
        this.opts = { debounceMs: 200, ...opts };
    }

    enqueue(key: string): void {
        this.pending.add(key);
        this.schedule();
    }

    /** 队列排空后 resolve。空闲时立即 resolve。 */
    idle(): Promise<void> {
        if (!this.isBusy()) return Promise.resolve();
        return new Promise((resolve) => this.idleWaiters.push(resolve));
    }

    private isBusy(): boolean {
        return this.draining || this.pending.size > 0 || this.timer !== null;
    }

    private schedule(): void {
        if (this.draining || this.timer) return;
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.drain();
        }, this.opts.debounceMs);
    }

    private async drain(): Promise<void> {
        if (this.draining) return;
        this.draining = true;
        try {
            // 每轮取当前快照:消费过程中新入队的 key 会进入下一轮,而不是打断本轮。
            while (this.pending.size) {
                const batch = [...this.pending];
                this.pending.clear();
                for (const key of batch) {
                    try {
                        await this.opts.run(key);
                    } catch (err) {
                        // 吞掉:队列必须继续,且这里的失败绝不能冒泡到触发它的 HTTP 请求上。
                        this.opts.onError?.(key, err);
                    }
                }
            }
        } finally {
            this.draining = false;
            if (!this.isBusy()) {
                const waiters = this.idleWaiters;
                this.idleWaiters = [];
                for (const w of waiters) w();
            } else {
                this.schedule();
            }
        }
    }
}
