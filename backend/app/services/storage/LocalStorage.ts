import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import type { StorageProvider, StorageProviderMeta } from "./StorageProvider.js";

/**
 * Local filesystem storage provider.
 * Saves files to a local directory and serves them via static route.
 */
export class LocalStorage implements StorageProvider {
    readonly name = "local";
    private uploadDir: string;

    constructor(config?: Record<string, string>) {
        this.uploadDir = config?.upload_dir || path.join(process.cwd(), "static/uploads");
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    async upload(file: string, destName: string, _mimeType: string): Promise<string> {
        const destPath = path.join(this.uploadDir, destName);
        await fsp.copyFile(file, destPath);
        try { await fsp.unlink(file); } catch {}
        return `/static/uploads/${destName}`;
    }

    async delete(url: string): Promise<void> {
        // url is like /static/uploads/xxx.jpg
        const filePath = path.join(process.cwd(), url);
        if (fs.existsSync(filePath)) {
            await fsp.unlink(filePath);
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            if (!fs.existsSync(this.uploadDir)) {
                await fsp.mkdir(this.uploadDir, { recursive: true });
            }
            const testFile = path.join(this.uploadDir, ".storage_test");
            await fsp.writeFile(testFile, "test");
            await fsp.unlink(testFile);
            return true;
        } catch {
            return false;
        }
    }
}

export const LocalStorageMeta: StorageProviderMeta = {
    name: "local",
    label: "Local Storage",
    description: "Save files to the server's local filesystem directory.",
    configFields: [
        {
            key: "upload_dir",
            label: "Upload Directory",
            type: "text",
            placeholder: "static/uploads",
            default: "static/uploads",
            required: false,
        },
    ],
};
