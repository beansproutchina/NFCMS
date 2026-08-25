// 由 `dyapi scan` 生成，请勿手改。改动源文件后重新生成即可。
//
// 全静态 import + 显式有序注册：bundler 能完整追踪、tree-shaking 不会误删、
// 打进 npm 包后运行时零文件系统读取。
import SqliteTestContainer from "./containers/testContainer.ts";
import AttachmentModel from "./models/AttachmentModel.ts";
import CategoryModel from "./models/CategoryModel.ts";
import MenuModel from "./models/MenuModel.ts";
import ResourceGrantModel from "./models/ResourceGrantModel.ts";
import RevisionModel from "./models/RevisionModel.ts";
import RoleModel from "./models/RoleModel.ts";
import RolePermissionModel from "./models/RolePermissionModel.ts";
import SystemConfigModel from "./models/SystemConfigModel.ts";
import UserModel from "./models/UserModel.ts";
import UserRoleModel from "./models/UserRoleModel.ts";
import ArticleModel from "./models/ArticleModel.ts";
import AclController from "./controllers/AclController.ts";
import ContentController from "./controllers/ContentController.ts";
import ContentLifecycleController from "./controllers/ContentLifecycleController.ts";
import SchemaDevController from "./controllers/SchemaDevController.ts";
import SystemController from "./controllers/SystemController.ts";
import UploadController from "./controllers/UploadController.ts";
import UserController from "./controllers/UserController.ts";

/**
 * 把本目录下的模块按角色顺序（容器 → 模型 → 服务 → 控制器）依次注册到作用域上。
 *
 * 注：本文件刻意不写 JSDoc 类型导入语法 —— bun 会把注释里的动态导入当成真实
 * 模块去解析，解析不到就整个文件加载失败。生成物要无趣到底。
 *
 * @param app 目标作用域（DYApp 或它的子类）
 */
export async function register(app) {
    await app.use(SqliteTestContainer);         // container
    await app.use(AttachmentModel);             // model
    await app.use(CategoryModel);               // model
    await app.use(MenuModel);                   // model
    await app.use(ResourceGrantModel);          // model
    await app.use(RevisionModel);               // model
    await app.use(RoleModel);                   // model
    await app.use(RolePermissionModel);         // model
    await app.use(SystemConfigModel);           // model
    await app.use(UserModel);                   // model
    await app.use(UserRoleModel);               // model
    await app.use(ArticleModel);                // model
    await app.use(AclController);               // controller
    await app.use(ContentController);           // controller
    await app.use(ContentLifecycleController);  // controller
    await app.use(SchemaDevController);         // controller
    await app.use(SystemController);            // controller
    await app.use(UploadController);            // controller
    await app.use(UserController);              // controller
}
