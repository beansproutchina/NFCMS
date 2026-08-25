import { test, expect, describe } from "bun:test";
import { PrerenderQueue } from "../app/services/PrerenderQueue.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * hook 是**串行 await** 的(HookManager.doAction),预渲染直接跑在 hook 里会把发布请求
 * 阻塞一两秒。所以 hook 只入队,队列在后台消费 —— 去重、串行、容错三件事都归它。
 */
describe("PrerenderQueue —— 去重 / 串行 / 容错", () => {
    test("同一 key 在 debounce 窗口内入队三次只执行一次", async () => {
        const ran: string[] = [];
        const q = new PrerenderQueue({ debounceMs: 30, run: async (k) => { ran.push(k); } });

        q.enqueue("a/news/hello.html");
        q.enqueue("a/news/hello.html");
        q.enqueue("a/news/hello.html");
        await q.idle();

        expect(ran).toEqual(["a/news/hello.html"]);
    });

    test("不同 key 各执行一次", async () => {
        const ran: string[] = [];
        const q = new PrerenderQueue({ debounceMs: 10, run: async (k) => { ran.push(k); } });
        q.enqueue("index.html");
        q.enqueue("a/news.html");
        q.enqueue("sitemap.xml");
        await q.idle();
        expect(ran.sort()).toEqual(["a/news.html", "index.html", "sitemap.xml"]);
    });

    /** 同时只开一个 chromium page —— 并发开页在小内存机器上会直接把容器打爆。 */
    test("队列串行执行，任意时刻并发数为 1", async () => {
        let live = 0;
        let peak = 0;
        const q = new PrerenderQueue({
            debounceMs: 5,
            run: async () => { live++; peak = Math.max(peak, live); await sleep(15); live--; },
        });
        for (const k of ["a", "b", "c", "d"]) q.enqueue(k);
        await q.idle();
        expect(peak).toBe(1);
    });

    /** S14:一页生成失败不能让队列停摆,更不能冒泡到发布请求上。 */
    test("单个任务抛错后队列继续消费剩余任务", async () => {
        const ran: string[] = [];
        const errs: string[] = [];
        const q = new PrerenderQueue({
            debounceMs: 5,
            run: async (k) => { if (k === "b") throw new Error("chromium boom"); ran.push(k); },
            onError: (k) => { errs.push(k); },
        });
        for (const k of ["a", "b", "c"]) q.enqueue(k);
        await q.idle();

        expect(ran.sort()).toEqual(["a", "c"]);
        expect(errs).toEqual(["b"]);
    });

    test("idle() 在空队列上立即 resolve", async () => {
        const q = new PrerenderQueue({ debounceMs: 5, run: async () => {} });
        await q.idle();
        expect(true).toBe(true);
    });
});
