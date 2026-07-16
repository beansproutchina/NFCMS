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
    ownerField = null; // shared media library (no per-user ownership)
    datafields = [
        F.String("filename").notNull(),
        F.String("url").notNull(),
        F.String("mime_type"),
        F.Number("size"),
        F.String("storage_provider").default("local"), // local, s3, tencent_cos, ...
    ];
}
