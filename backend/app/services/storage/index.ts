import type { StorageProvider, StorageProviderMeta } from "./StorageProvider.js";
import { LocalStorage, LocalStorageMeta } from "./LocalStorage.js";
import { S3Storage, S3StorageMeta } from "./S3Storage.js";
import { TencentCOSStorage, TencentCOSStorageMeta } from "./TencentCOSStorage.js";

// ─── Provider Registry ───────────────────────────────────────────────
// To add a new storage provider:
//   1. Create a file implementing StorageProvider interface
//   2. Export a StorageProviderMeta for it
//   3. Register both here

interface ProviderRegistryEntry {
    providerClass: new (config: Record<string, string>) => StorageProvider;
    meta: StorageProviderMeta;
}

const providerRegistry = new Map<string, ProviderRegistryEntry>();

function registerProvider(cls: new (config: Record<string, string>) => StorageProvider, meta: StorageProviderMeta) {
    providerRegistry.set(meta.name, { providerClass: cls, meta });
}

// Register built-in providers
registerProvider(LocalStorage, LocalStorageMeta);
registerProvider(S3Storage, S3StorageMeta);
registerProvider(TencentCOSStorage, TencentCOSStorageMeta);

// ─── Factory & Helpers ───────────────────────────────────────────────

/** Get all registered provider metadata (for admin UI) */
export function getProviderMetas(): StorageProviderMeta[] {
    return Array.from(providerRegistry.values()).map(e => e.meta);
}

/** Create a storage provider instance by name */
export function createStorageProvider(name: string, config: Record<string, string>): StorageProvider {
    const entry = providerRegistry.get(name);
    if (!entry) {
        throw new Error(`Unknown storage provider: ${name}. Available: ${Array.from(providerRegistry.keys()).join(", ")}`);
    }
    return new entry.providerClass(config);
}

/** Get a single provider's metadata by name */
export function getProviderMeta(name: string): StorageProviderMeta | undefined {
    return providerRegistry.get(name)?.meta;
}

/**
 * Register a custom storage provider at runtime (for plugins/extensions).
 * @param cls - The provider class constructor
 * @param meta - The provider metadata
 */
export function registerCustomProvider(cls: new (config: Record<string, string>) => StorageProvider, meta: StorageProviderMeta) {
    registerProvider(cls, meta);
}

export type { StorageProvider, StorageProviderMeta, StorageConfigField } from "./StorageProvider.js";
