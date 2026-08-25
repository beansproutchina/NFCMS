import { chromium, type Browser, type BrowserContext } from "playwright-core";

/**
 * 预渲染用的 headless chromium。
 *
 * **懒启动**:没有内容变更的站点根本不该跑一个浏览器。第一次快照时才拉起来。
 * **空闲自关**:生成完一批就放掉几百 MB —— 单容器里 bun + nginx + chromium 挤同一份内存。
 * **定期重启**:chromium 长跑会缓慢涨内存;每 N 页换一个进程,比调参可靠。
 *
 * 用 `playwright-core` 而不是 `playwright`:后者 install 时会下载浏览器二进制,信创离线内网
 * 不可接受。二进制由镜像的 `apk add chromium` 提供,用 `SSG_CHROMIUM_PATH` 指过去。
 */

/** 生成器带的旁路标记。nginx 见到它就不吃自己生成的静态文件 —— 否则快照的是快照。 */
export const BYPASS_HEADER = "X-SSG-Bypass";

export interface SnapshotResult {
    /** 页面自报渲染成功时的 HTML;`data-ssg-error` 或超时则为 null(调用方**不要写文件**)。 */
    html: string | null;
    reason?: "error-signal" | "timeout" | "launch-failed";
}

export interface BrowserPoolOptions {
    /** 生成器访问的站点根,如 `http://127.0.0.1`(容器内 nginx)或 `http://localhost:4174`。 */
    baseUrl: string;
    /** chromium 可执行文件。缺省交给 playwright 自己找。 */
    executablePath?: string;
    /** 等就绪信号的上限。到点即放弃这一页,不写文件。 */
    timeoutMs?: number;
    /** 开多少页之后换一个 browser 进程。 */
    recycleAfter?: number;
    /** 空闲多久关掉浏览器。 */
    idleCloseMs?: number;
}

export class BrowserPool {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private pagesSinceLaunch = 0;
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly opts: Required<Omit<BrowserPoolOptions, "executablePath">> &
        Pick<BrowserPoolOptions, "executablePath">;

    constructor(opts: BrowserPoolOptions) {
        this.opts = { timeoutMs: 15000, recycleAfter: 50, idleCloseMs: 60000, ...opts };
    }

    /**
     * 改生成目标站点(dev 的预览服务器 vs 生产的容器内 nginx)。
     *
     * 提供这个方法是因为调用方**不能**直接换掉整个 pool 实例:在途的 `snapshot()` 还持有旧
     * 实例的 page,换掉之后那些页面就成了孤儿,表现为一批莫名其妙的超时。
     */
    setBaseUrl(baseUrl: string) {
        this.opts.baseUrl = baseUrl;
    }

    private async ensure(): Promise<BrowserContext> {
        if (this.context && this.pagesSinceLaunch < this.opts.recycleAfter) return this.context;
        if (process.env.SSG_TRACE) console.log(`[ssg:trace] launching chromium (pages=${this.pagesSinceLaunch})`);
        await this.close();
        this.browser = await chromium.launch({
            executablePath: this.opts.executablePath || undefined,
            headless: true,
            // --no-sandbox:容器里以 root 跑 chromium 的标准要求。
            // --disable-dev-shm-usage:/dev/shm 在容器里默认只有 64MB,不加会随机崩页。
            args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        });
        this.context = await this.browser.newContext({
            extraHTTPHeaders: { [BYPASS_HEADER]: "1" },
            // 显式匿名:静态页是给所有人的,绝不能带上任何登录态。
            storageState: undefined,
        });
        this.pagesSinceLaunch = 0;
        if (process.env.SSG_TRACE) console.log(`[ssg:trace] chromium ready`);
        return this.context;
    }

    /**
     * 打开一个 URL 并返回渲染完成后的 HTML。
     *
     * 等的是 `html[data-ssg-ready]`(应用自报),不是 networkidle —— 后者会被一个连不上的
     * 外部字体 CDN 永久卡住(见 DynamicView 里的说明)。
     */
    async snapshot(urlPath: string): Promise<SnapshotResult> {
        if (process.env.SSG_TRACE) console.log(`[ssg:trace] snapshot(${urlPath}) enter`);
        this.cancelIdleClose();
        let ctx: BrowserContext;
        try {
            ctx = await this.ensure();
        } catch (e) {
            // chromium 起不来是运维问题,不该把发布请求也带崩(S14)。
            console.error(`[ssg] chromium 启动失败:`, (e as any)?.message);
            return { html: null, reason: "launch-failed" };
        }

        if (process.env.SSG_TRACE) console.log(`[ssg:trace] ctx ready, newPage ${urlPath}`);
        const page = await ctx.newPage();
        this.pagesSinceLaunch++;
        try {
            const url = new URL(urlPath, this.opts.baseUrl).toString();
            // domcontentloaded 而不是 load:外部字体/图片不该拖住我们,就绪由应用自报。
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: this.opts.timeoutMs });
            await page.waitForSelector("html[data-ssg-ready], html[data-ssg-error]", {
                timeout: this.opts.timeoutMs,
            });
            const failed = await page.evaluate(() => document.documentElement.hasAttribute("data-ssg-error"));
            if (failed) return { html: null, reason: "error-signal" };
            return { html: await page.evaluate(() => document.documentElement.outerHTML) };
        } catch {
            return { html: null, reason: "timeout" };
        } finally {
            await page.close().catch(() => {});
            this.scheduleIdleClose();
        }
    }

    private cancelIdleClose() {
        if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; }
    }

    private scheduleIdleClose() {
        this.cancelIdleClose();
        this.idleTimer = setTimeout(() => { void this.close(); }, this.opts.idleCloseMs);
    }

    async close(): Promise<void> {
        this.cancelIdleClose();
        const b = this.browser;
        this.browser = null;
        this.context = null;
        await b?.close().catch(() => {});
    }
}
