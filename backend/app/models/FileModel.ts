import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, PopTarget } from "dyapi/utils/decorators.js";

/**
 * 通用文件管理（附件、缩略图等）
 */
@CRUD("files")
@PopTarget("uid")
export default class FileModel extends Model {
    tablename = "files";
    datafields = [
        F.String("name").notNull(),
        F.String("url").notNull(), // 文件最终访问URL (S3/OSS/Local)
        F.String("type").notNull(), // image, doc, etc.
        F.String("provider").default("local"), // 存储提供商
        F.Int("size").default(0), // 文件大小 bytes
        F.String("uploader_id"), // 上传者
        F.Date("created_at"),
    ];
    permission = {
        "PUBLIC": "R",
        "admin": "C,R,U,D" // admin以上可管理
    };
}