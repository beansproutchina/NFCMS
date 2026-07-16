import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import type { StorageProvider, StorageProviderMeta } from "./StorageProvider.js";

/**
 * S3-compatible storage provider.
 * Works with AWS S3, MinIO, Cloudflare R2, and any S3-compatible service.
 */
export class S3Storage implements StorageProvider {
    readonly name = "s3";

    private endpoint: string;
    private region: string;
    private bucket: string;
    private accessKeyId: string;
    private secretAccessKey: string;
    private publicUrl: string; // custom public URL base (optional)
    private pathStyle: boolean;
    private forcePathStyle: boolean;
    private prefix: string;

    constructor(config: Record<string, string>) {
        this.endpoint = config.endpoint || "";
        this.region = config.region || "us-east-1";
        this.bucket = config.bucket || "";
        this.accessKeyId = config.access_key || "";
        this.secretAccessKey = config.secret_key || "";
        this.publicUrl = config.public_url || "";
        this.pathStyle = config.path_style === "true";
        this.forcePathStyle = this.pathStyle;
        this.prefix = config.prefix || "";
        this.prefix = this.prefix.replace(/^\/+id|\/+$/g, "");
    }

    private getClient() {
        // Use AWS SDK v3 - lazy import to avoid hard dependency
        try {
            const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
            const clientConfig: any = {
                region: this.region,
                credentials: {
                    accessKeyId: this.accessKeyId,
                    secretAccessKey: this.secretAccessKey,
                },
            };
            if (this.endpoint) {
                clientConfig.endpoint = this.endpoint;
            }
            if (this.forcePathStyle) {
                clientConfig.forcePathStyle = true;
            }
            return { S3Client, PutObjectCommand, DeleteObjectCommand, client: new S3Client(clientConfig) };
        } catch (e: any) {
            throw new Error("AWS SDK not installed. Run: bun add @aws-sdk/client-s3");
        }
    }

    async upload(file: string, destName: string, mimeType: string): Promise<string> {
        const finalDestName = this.prefix ? `${this.prefix}/${destName}` : destName;
        const { client, PutObjectCommand } = this.getClient();
        const fileBuffer = await fsp.readFile(file);

        await client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: finalDestName,
            Body: fileBuffer,
            ContentType: mimeType,
        }));

        // Clean up temp file
        try { await fsp.unlink(file); } catch { }

        // Build the public URL
        if (this.publicUrl) {
            return `${this.publicUrl.replace(/\/+$/, "")}/${finalDestName}`;
        }
        if (this.endpoint) {
            const base = this.endpoint.replace(/\/+$/, "");
            if (this.forcePathStyle) {
                return `${base}/${this.bucket}/${finalDestName}`;
            }
            return `${base}/${finalDestName}`;
        }
        return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${finalDestName}`;
    }

    async delete(url: string): Promise<void> {
        const { client, DeleteObjectCommand } = this.getClient();
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
        } else if (this.endpoint && this.forcePathStyle && key.startsWith(`${this.bucket}/`)) {
            key = key.slice(this.bucket.length + 1);
        }


        await client.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        }));
    }

    async testConnection(): Promise<boolean> {
        try {
            const { client } = this.getClient();
            const { HeadBucketCommand } = require("@aws-sdk/client-s3");
            await client.send(new HeadBucketCommand({ Bucket: this.bucket }));
            return true;
        } catch {
            return false;
        }
    }
}

export const S3StorageMeta: StorageProviderMeta = {
    name: "s3",
    label: "S3 Compatible",
    description: "Amazon S3, MinIO, Cloudflare R2, or any S3-compatible object storage.",
    configFields: [
        {
            key: "endpoint",
            label: "Endpoint",
            type: "text",
            placeholder: "https://s3.amazonaws.com (leave empty for AWS default)",
            required: false,
        },
        {
            key: "region",
            label: "Region",
            type: "text",
            placeholder: "us-east-1",
            default: "us-east-1",
            required: true,
        },
        {
            key: "bucket",
            label: "Bucket",
            type: "text",
            placeholder: "my-bucket",
            required: true,
        },
        {
            key: "access_key",
            label: "Access Key ID",
            type: "text",
            placeholder: "AKIA...",
            required: true,
        },
        {
            key: "secret_key",
            label: "Secret Access Key",
            type: "password",
            placeholder: "",
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
        {
            key: "path_style",
            label: "Path Style Access",
            type: "select",
            default: "false",
            options: [
                { label: "Virtual-hosted style (default)", value: "false" },
                { label: "Path style (for MinIO etc.)", value: "true" },
            ],
            required: false,
        },
    ],
};
