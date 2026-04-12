import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, PopTarget } from "dyapi/utils/decorators.js";

/**
 * 菜单管理：支持多条菜单和嵌套项。
 */
@CRUD("menus")
@PopTarget("uid")
export default class MenuModel extends Model {
    tablename = "menus";
    datafields = [
        F.String("name").notNull(), // 菜单名，例如 "Main Nav"或"Foorter Nav"
        F.Array("items").default([]), // 嵌套菜单项 [{label, type: category/article/external, targetId/url, children: []}]
    ];
    permission = {
        "PUBLIC": "R",
        "super_admin": "C,R,U,D" // 仅超级管理员管理
    };
}