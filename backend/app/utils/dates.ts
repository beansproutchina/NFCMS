/**
 * 日期值的边界归一化。
 */

/**
 * 判断一个日期列**实质为空**。
 *
 * 为什么不能直接写 `!row.published_at`:容器的 `update` 路径把 JS `null` 走了
 * `JSON.stringify(null)`,于是库里存的是 4 个字符的**文本 `"null"`** —— 而它是 truthy。
 * (`create`/`#insert` 那条路径有显式 null 守卫,写出来的是真 NULL,两条路径不一致。)
 *
 * 后果很具体:"首次发布时盖 `published_at`"这类守卫会认为字段已有值而跳过,作者清空过日期的
 * 文章再也拿不到发布时间。所以凡是判"这个日期列有没有值",一律走这里。
 *
 * 前端有一份镜像逻辑(`Editor.vue` 的 `toDate`,把同样这几种脏值收成 `null`)。
 */
export function isBlankDate(v: any): boolean {
    if (v == null || v === "" || v === "null") return true;
    return Number.isNaN(new Date(v).getTime());
}
