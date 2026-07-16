import * as fs from "fs";
import type { StorageProvider, StorageProviderMeta } from "./StorageProvider.js";
import * as fsp from "fs/promises"
/**
 * Tencent Cloud Object Storage (COS) provider.
 * Uses COS Node.js SDK.
 */
export class TencentCOSStorage implements StorageProvider {
    readonly name = "tencent_cos";

    private secretId: string;
    private secretKey: string;
    private bucket: string;
    private region: string;
    private publicUrl: string;
    private prefix: string;
    private cos = null;

    constructor(config: Record<string, string>) {
        this.secretId = config.secret_id || "";
        this.secretKey = config.secret_key || "";
        this.bucket = config.bucket || "";
        this.region = config.region || "ap-guangzhou";
        this.publicUrl = config.public_url || "";
        this.prefix = config.prefix || "";
        this.prefix = this.prefix.replace(/^\/+id|\/+$/g, "");
    }

    private getClient() {
        if (!this.cos) {
            const COS = require("cos-nodejs-sdk-v5");
            this.cos = new COS({
                SecretId: this.secretId,
                SecretKey: this.secretKey,
            })
        }
        return this.cos;
    }

    async upload(file: string, destName: string, mimeType: string): Promise<string> {
        const finalDestName = this.prefix ? `${this.prefix}/${destName}` : destName;
        const cos = this.getClient();
        const body = await fsp.readFile(file);
        await new Promise<void>((resolve, reject) => {
            cos.putObject({
                Bucket: this.bucket,
                Region: this.region,
                Key: finalDestName,
                Body: body,
                ContentLength: fs.statSync(file).size,
                ContentType: mimeType,
            }, (err: any, data: any) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Clean up temp file
        try { await fsp.unlink(file); } catch { }

        // Build the public URL
        if (this.publicUrl) {
            return `${this.publicUrl.replace(/\/+$/, "")}/${finalDestName}`;
        }
        return `https://${this.bucket}.cos.${this.region}.myqcloud.com/${finalDestName}`;
    }

    async delete(url: string): Promise<void> {
        const cos = this.getClient();
        // Extract key from URL - take the filename portion
        let key = url;
        const parsed = new URL(url);
        key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
        if (this.publicUrl) {
            const publicParsed = new URL(this.publicUrl);
            const publicPath = publicParsed.pathname.replace(/^\/+/, "");
            if (publicPath && key.startsWith(publicPath)) {
                key = key.slice(publicPath.length).replace(/^\/+/, "");
            }
        }

        await new Promise<void>((resolve, reject) => {
            cos.deleteObject({
                Bucket: this.bucket,
                Region: this.region,
                Key: key,
            }, (err: any, data: any) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async testConnection(): Promise<boolean> {
        try {
            const cos = this.getClient();
            const res = await new Promise<void>((resolve, reject) => {
                cos.headBucket({
                    Bucket: this.bucket,
                    Region: this.region,
                }, (err: any, data: any) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });
            return true;
        } catch {
            return false;
        }
    }
}

export const TencentCOSStorageMeta: StorageProviderMeta = {
    name: "tencent_cos",
    label: "Tencent COS",
    description: "Tencent Cloud Object Storage (腾讯云对象存储).",
    configFields: [
        {
            key: "secret_id",
            label: "SecretId",
            type: "text",
            placeholder: "AKID...",
            required: true,
        },
        {
            key: "secret_key",
            label: "SecretKey",
            type: "password",
            placeholder: "",
            required: true,
        },
        {
            key: "bucket",
            label: "Bucket",
            type: "text",
            placeholder: "my-bucket-1250000000",
            required: true,
        },
        {
            key: "region",
            label: "Region",
            type: "text",
            placeholder: "ap-guangzhou",
            default: "ap-guangzhou",
            required: true,
        },
        {
            key: "prefix",
            label: "File Prefix / Folder",
            type: "text",
            placeholder: "uploads (optional)",
            required: false,
        },
        {
            key: "public_url",
            label: "Custom Public URL",
            type: "text",
            placeholder: "https://cdn.example.com (optional, for CDN)",
            required: false,
        },
    ],
};
