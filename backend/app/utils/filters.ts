/**
 * 查询 filter 的组合工具。CMSModel(管辖轴)与 readPublic(受众轴)共用 —— 单一出处,别复制第二份。
 */

/** AND 两个 filter 对象。用 `$and1`/`$and2` 包裹,键永不相撞。空对象视为"无约束"。 */
export function mergeFilter(a: any, b: any): any {
    const ae = a && Object.keys(a).length > 0;
    const be = b && Object.keys(b).length > 0;
    if (ae && be) return { $and1: a, $and2: b };
    return ae ? a : be ? b : {};
}
