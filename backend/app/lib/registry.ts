/**
 * 已注册模型的读取口 —— **按 tablename 找模型实例的唯一出处**。
 *
 * 为什么要收在这里:
 *
 * 1. dyapi 3.3 起注册表从普通对象改成了 `Map`(class 当对象键会被 `String()` 成整段类源码,
 *    既慢又会让同源码的两个类互相覆盖)。于是 `Object.values(app.models)` 从"能用"变成
 *    **静默返回空数组** —— 不抛错,只是所有按 tablename 的解析全部落空。升级时三处中招:
 *    `SystemController.getAllModels`、`ModelInjector` 的重复注册守卫、`AudienceService.model`。
 * 2. 另外四处调用点各自写了一遍 `dict instanceof Map ? [...] : Object.values(dict)`。同一件事
 *    四份实现,下次框架再动注册表就得再改四处。
 *
 * 这里刻意**不 import 任何模型类**:ArticleModel / CategoryModel 都会调用方(如 AudienceService),
 * 反向 import 会形成 ESM 循环依赖,实测炸成 `Cannot access 'CMSModel' before initialization`。
 * 代价是丢掉静态类型,收益是没有环。
 *
 * 作用域:只看传入的那一个作用域。NFCMS 是单作用域应用(没有挂载插件),要支持微后端时再沿
 * `_app` / `children` 展开。
 */

/** 本作用域注册的全部 Model 实例。 */
export function registeredModels(app: any): any[] {
    const models = app?.models;
    if (!models) return [];
    return [...models.values()];
}

/** 按 tablename 找模型实例;找不到返回 undefined。 */
export function findModelByTable(app: any, tablename: string): any | undefined {
    return registeredModels(app).find((m: any) => m?.tablename === tablename);
}

/** 按 tablename 找模型实例,找不到抛错。调用方需要"必须存在"语义时用它。 */
export function requireModelByTable(app: any, tablename: string): any {
    const found = findModelByTable(app, tablename);
    if (!found) throw new Error(`model for table '${tablename}' not registered`);
    return found;
}
