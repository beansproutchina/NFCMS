import { F } from "dyapi/core/datafield.js";
import { CMSModel } from "../lib/CMSModel.js";
import { CRUD, Inject } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";

/**
 * Global attachment metadata (local/S3/Tencent COS). Governed by RBAC (CMSModel) — the media
 * library is shared, so grants use `any` scope. Uploads/deletes of the files themselves go through
 * the auth-gated UploadController; the public site references URLs via static serving.
 */
@CRUD("attachments")
export default class AttachmentModel extends CMSModel {
    @Inject(testContainer) declare container;
    tablename = "attachments";
    /**
     * 上传者。加这一列之前 `ownerField` 是 null,于是给附件配 `own` 是**静默无效**的 ——
     * PolicyService 的 own 路径要求属主列存在(见 can()),配了不报错也不生效。
     * 老库里的历史行为 null:它们不属于任何人,只有 `any` 能管,这是可接受的降级。
     */
    ownerField = "uploader_id";
    datafields = [
        F.String("filename").notNull(),
        F.String("url").notNull(),
        F.String("mime_type"),
        F.Number("size"),
        F.String("storage_provider").default("local"), // local, s3, tencent_cos, ...
        F.Number("uploader_id"),   // ownerField —— 使"只能管自己上传的文件"可表达
    ];
}
