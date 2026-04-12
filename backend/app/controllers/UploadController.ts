import { ControllerRoute, Route, Inject } from "dyapi/utils/decorators.js";
import { Controller } from "dyapi/core/controller.js";
import testContainer from "../containers/testContainer.js";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import AttachmentModel from "../models/AttachmentModel.js";

/**
 * Unified Upload Controller
 */
@ControllerRoute("upload")
export default class UploadController extends Controller {
    @Inject(AttachmentModel) declare attachmentModel: AttachmentModel;
    uploadDir = path.join(process.cwd(), "static/uploads");

    constructor(...args: any[]) {
        super(...args);
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    @Route("post", "")
    async uploadFile(ctx: any) {
        if (!ctx.state?.user) {
            return { code: 403, message: "Authentication required." };
        }

        const files = ctx.request?.files || ctx.state?.files;
        if (!files || Object.keys(files).length === 0) {
            return { code: 400, message: "No files provided." };
        }

        const results = [];
        for (const key of Object.keys(files)) {
            const rawFile = files[key];
            const fileArray = Array.isArray(rawFile) ? rawFile : [rawFile];

            for (const file of fileArray) {
                const ext = path.extname(file.originalFilename || file.filename || file.name || "");
                const randomName = crypto.randomBytes(16).toString("hex") + ext;
                const destPath = path.join(this.uploadDir, randomName);
                const url = `/static/uploads/${randomName}`;
                fs.copyFileSync(file.filepath || file.path || file.tempFilePath, destPath);
                fs.unlinkSync(file.filepath || file.path || file.tempFilePath);
                // Save to database
                const payload = {
                    filename: file.originalFilename || file.filename || file.name || randomName,
                    url: url,
                    mime_type: file.mimetype || file.type || "application/octet-stream",
                    size: file.size || 0,
                    storage_provider: "local"
                };
                const insertId = await this.attachmentModel.create(payload);

                results.push({
                    id: insertId,
                    ...payload
                });
            }
        }

        return { code: 200, data: results };
    }

    @Route("delete", "/:id")
    async deleteFile(ctx: any) {
        if (!ctx.state?.user) {
            return { code: 403, message: "Authentication required." };
        }

        const id = ctx.params.id;
        const records = await this.attachmentModel.read({ filter: { id: parseInt(id) } });

        if (records && records.length > 0) {
            const record = records[0];
            const filePath = path.join(process.cwd(),  record.url);

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            await this.attachmentModel.remove({ id: parseInt(id) });
            return { code: 200, message: "File deleted successfully." };
        }

        return { code: 404, message: "File not found." };
    }
}
