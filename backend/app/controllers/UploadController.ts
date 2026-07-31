import { ControllerRoute, Route, Inject } from "dyapi/utils/decorators.js";
import { Controller } from "dyapi/core/controller.js";
import * as path from "path";
import * as crypto from "crypto";
import AttachmentModel from "../models/AttachmentModel.js";
import SystemConfigModel from "../models/SystemConfigModel.js";
import { createStorageProvider, getProviderMetas } from "../services/storage/index.js";
import { policy } from "../services/PolicyService.js";

/**
 * Unified Upload Controller with pluggable storage providers.
 *
 * Storage config is stored as a single JSON key "storage_config" in system_config:
 * {
 *   "provider": "local",
 *   "local": { "upload_dir": "static/uploads" },
 *   "s3": { "endpoint": "...", "region": "...", ... },
 *   "tencent_cos": { "secret_id": "...", ... }
 * }
 */
@ControllerRoute("upload")
export default class UploadController extends Controller {
    @Inject(AttachmentModel) declare attachmentModel: AttachmentModel;
    @Inject(SystemConfigModel) declare configModel: SystemConfigModel;

    /** Parse the storage_config JSON from system config */
    private async getStorageConfig(): Promise<{ provider: string; [key: string]: any }> {
        const config = await this.configModel.GetConfig();
        const raw = config?.storage_config;
        if (!raw) {
            return { provider: "local" };
        }
        try {
            return typeof raw === "string" ? JSON.parse(raw) : raw;
        } catch {
            return { provider: "local" };
        }
    }

    /** Get the active provider config as a flat key-value map for the provider constructor */
    private getProviderConfig(providerName: string, storageConfig: Record<string, any>): Record<string, string> {
        const providerData = storageConfig[providerName];
        if (!providerData || typeof providerData !== "object") {
            return {};
        }
        // Flatten the provider-specific sub-object
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(providerData)) {
            result[key] = String(value);
        }
        return result;
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

        const storageConfig = await this.getStorageConfig();
        const providerName = storageConfig.provider || "local";
        const providerConfig = this.getProviderConfig(providerName, storageConfig);
        const provider = createStorageProvider(providerName, providerConfig);

        const results = [];
        for (const key of Object.keys(files)) {
            const rawFile = files[key];
            const fileArray = Array.isArray(rawFile) ? rawFile : [rawFile];

            for (const file of fileArray) {
                const ext = path.extname(file.originalFilename || file.filename || file.name || "");
                const randomName = crypto.randomBytes(16).toString("hex") + ext;
                const tempPath = file.filepath || file.path || file.tempFilePath;
                const mimeType = file.mimetype || file.type || "application/octet-stream";

                let url: string;
                try {
                    url = await provider.upload(tempPath, randomName, mimeType);
                } catch (e: any) {
                    console.error(`Upload failed via ${providerName}:`, e.message);
                    // Clean up temp file on failure
                    try { require("fs").unlinkSync(tempPath); } catch {}
                    return { code: 500, message: `Upload failed: ${e.message}` };
                }

                const payload = {
                    filename: file.originalFilename || file.filename || file.name || randomName,
                    url: url,
                    mime_type: mimeType,
                    size: file.size || 0,
                    storage_provider: providerName,
                    // 裸 create 不经 HTTPCreate,属主要自己填(见 AttachmentModel.ownerField)
                    uploader_id: ctx.state?.user?.id ?? null,
                };
                const insertId = await this.attachmentModel.create(payload);

                results.push({
                    id: insertId,
                    ...payload,
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
            const providerName = record.storage_provider || "local";

            try {
                const storageConfig = await this.getStorageConfig();
                const providerConfig = this.getProviderConfig(providerName, storageConfig);
                const provider = createStorageProvider(providerName, providerConfig);
                await provider.delete(record.url);
            } catch (e: any) {
                console.error(`Delete failed via ${providerName}:`, e.message);
                // Continue to remove DB record even if file delete fails
            }

            await this.attachmentModel.remove({ id: parseInt(id) });
            return { code: 200, message: "File deleted successfully." };
        }

        return { code: 404, message: "File not found." };
    }

    /**
     * Get available storage providers and their config schemas.
     * Used by admin settings UI to render dynamic configuration forms.
     */
    @Route("get", "/providers")
    async getProviders(ctx: any) {
        if (!ctx.state?.user || !policy.isSuper(ctx.state)) {
            return { code: 403, message: "Permission Denied." };
        }

        const metas = getProviderMetas();
        const storageConfig = await this.getStorageConfig();

        return {
            code: 200,
            data: {
                activeProvider: storageConfig.provider || "local",
                storageConfig,
                providers: metas,
            },
        };
    }

    /**
     * Test the connection for the current or specified storage provider.
     */
    @Route("post", "/test")
    async testStorage(ctx: any) {
        if (!ctx.state?.user || !policy.isSuper(ctx.state)) {
            return { code: 403, message: "Permission Denied." };
        }

        const { provider } = ctx.request.body || {};
        const storageConfig = await this.getStorageConfig();
        const providerName = provider || storageConfig.provider || "local";

        try {
            const providerConfig = this.getProviderConfig(providerName, storageConfig);
            const storageProvider = createStorageProvider(providerName, providerConfig);

            if (storageProvider.testConnection) {
                const ok = await storageProvider.testConnection();
                return { code: 200, data: { provider: providerName, success: ok } };
            }
            return { code: 200, data: { provider: providerName, success: true, note: "No test method available" } };
        } catch (e: any) {
            return { code: 500, data: { provider: providerName, success: false, error: e.message } };
        }
    }
}
