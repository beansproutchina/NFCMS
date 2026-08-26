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
        // url is like /static/uploads/xxx.jpg。
        // 只允许删除 uploadDir 内的文件:取 basename 再拼进 uploadDir,任何 `../` 都被剥掉。
        // 纵深防御 —— 即使 DB 里的 url 被篡改成 "/../.env" 或 "/../data/test.db",也删不到目录外。
        const base = path.resolve(this.uploadDir);
        const name = path.basename(url || "");
        if (!name || name === "." || name === "..") return;
        const filePath = path.resolve(base, name);
        if (filePath !== base && filePath.startsWith(base + path.sep) && fs.existsSync(filePath)) {
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
