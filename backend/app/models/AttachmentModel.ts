import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, Inject } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";

/**
 * Global Attachment for local/S3/Tencent Object Storage
 */
@CRUD("attachments")
export default class AttachmentModel extends Model {
    @Inject(testContainer) declare container;
    tablename = "attachments";
    datafields = [
        F.String("filename").notNull(),
        F.String("url").notNull(),
        F.String("mime_type"),
        F.Number("size"),
        F.String("storage_provider").default("local"), // local, s3, tencent_cos, ...
    ];
    // Uploads/deletes go through the auth-gated UploadController (POST /upload, DELETE /upload/:id).
    // The public site references file URLs directly via static serving, so it never needs /attachments.
    permission = {
        "PUBLIC": "",
        "DEFAULT": "",
        "admin": "R",
        "super_admin": "C,R,U,D"
    };
};
