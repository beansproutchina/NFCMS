import { test, expect, describe, afterAll } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import { SQLiteContainer } from "dyapi/containers/SqliteContainer.dyapi.js";
import { F } from "dyapi/core/datafield.js";
import { isBlankDate } from "../app/utils/dates.js";

/**
 * `published_at` 的语义:**首次公开时间**,而不是创建时间。
 *
 * 这里锁两件事,因为它们各自坏过一次:
 *  1. 容器给缺省的 Date 列自动填 `new Date()` —— 所以 `ArticleModel.create` 必须显式写 null,
 *     否则草稿一建出来就带着"发布时间",而"首次转 visible 才盖章"的守卫从此永远跳过。
 *  2. 空判必须走 `isBlankDate` —— 容器的 update 路径把 null 写成文本 `"null"`,而它是 truthy。
 */

const files: string[] = [];
async function newContainer() {
    const file = path.join(os.tmpdir(), `nfcms-publishedat-${Math.random().toString(16).slice(2)}.db`);
    files.push(file);
    const c: any = new SQLiteContainer({ settings: {} });
    c.filename = file;
    await c.init();
    // 只建本用例关心的列,字段类型与 ArticleModel 一致。
    await c.setField("t", F.String("title"));
    await c.setField("t", F.String("status").default("hidden"));
    await c.setField("t", F.Date("publish_at"));
    await c.setField("t", F.Date("published_at"));
    await c.setField("t", F.Date("created_at"));
    await c.setField("t", F.Date("updated_at"));
    return c;
}

afterAll(() => {
    for (const f of files) {
        for (const ext of ["", "-wal", "-shm"]) {
            try { fs.rmSync(f + ext, { force: true }); } catch { }
        }
    }
});

describe("isBlankDate —— 判「这个日期列有没有值」的唯一入口", () => {
    test("真 NULL / undefined / 空串 都算空", () => {
        expect(isBlankDate(null)).toBe(true);
        expect(isBlankDate(undefined)).toBe(true);
        expect(isBlankDate("")).toBe(true);
    });

    test("关键用例:文本 \"null\" 算空 —— 它是 truthy,`!row.published_at` 会判错", () => {
        expect(isBlankDate("null")).toBe(true);
    });

    test("无法解析的脏值算空(与前端 toDate 的归一化一致)", () => {
        expect(isBlankDate("garbage")).toBe(true);
        expect(isBlankDate(new Date("null"))).toBe(true);
    });

    test("真有日期时不算空", () => {
        expect(isBlankDate("2026-06-15T01:00:00.000Z")).toBe(false);
        expect(isBlankDate(new Date("2026-06-15T01:00:00.000Z"))).toBe(false);
    });
});

describe("插入时的 Date 列默认值 —— create 为什么必须显式写 null", () => {
    test("缺省的 Date 列被自动填成当前时间(这正是 published_at 曾经的坑)", async () => {
        const c = await newContainer();
        await c.create("t", { title: "没传任何日期" });
        const row = (await c.read("t", { page: 0, limit: 10 }))[0];
        // created_at/updated_at 要的就是这个行为
        expect(isBlankDate(row.created_at)).toBe(false);
        expect(isBlankDate(row.updated_at)).toBe(false);
        // 但同一个默认落到这两个"事件时间"上就是错的
        expect(isBlankDate(row.published_at)).toBe(false);
        expect(isBlankDate(row.publish_at)).toBe(false);
    });

    test("显式传 null 写出真 NULL —— 守卫因此能认出「还没发布过」", async () => {
        const c = await newContainer();
        await c.create("t", { title: "草稿", published_at: null, publish_at: null });
        const row = (await c.read("t", { page: 0, limit: 10 }))[0];
        expect(row.published_at).toBe(null);
        expect(row.publish_at).toBe(null);
        expect(isBlankDate(row.published_at)).toBe(true);
        // 创建元数据不受影响,照旧自动填
        expect(isBlankDate(row.created_at)).toBe(false);
    });

    test("显式传日期时不被覆盖(作者补录旧文章的日期 / 种子数据)", async () => {
        const c = await newContainer();
        const backdated = new Date("2024-03-01T08:00:00.000Z");
        await c.create("t", { title: "补录", published_at: backdated });
        const row = (await c.read("t", { page: 0, limit: 10 }))[0];
        expect(row.published_at).toBe("2024-03-01T08:00:00.000Z");
    });
});
