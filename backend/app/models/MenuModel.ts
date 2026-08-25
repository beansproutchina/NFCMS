import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, Inject } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";

/**
 * Menu Model covering nested items natively with JSON array
 */
@CRUD("menus")
export default class MenuModel extends Model {
    @Inject(testContainer) declare container;
    tablename = "menus";
    datafields = [
        F.String("name").notNull(),
        F.String("location"), // e.g. 'header', 'footer'
        /**
         * 整棵菜单树。声明成 `F.Array` 而不是 `F.Object`:这个字段存的**就是数组**,而
         * `F.Array` 自带 `.default([])` —— 空菜单于是是 `[]`,消费方(主题的 `menus.find(...)`
         * → `.items.map(...)`)不必先判一次 NULL。两者在 SQLite 上同为 TEXT 列,改声明不动存储。
         */
        F.Array("items"),
    ];
    permission = {
        "PUBLIC": "R",
        "DEFAULT": "R",
        "super_admin": "C,R,U,D"
    };
    async HTTPUpdate(state, query, body) {
        state.settingsOverrides.maxLimit = 9999;
        return await super.HTTPUpdate(state, query, body);
    }
}
