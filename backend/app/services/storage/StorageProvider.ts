/**
 * Storage Provider Interface
 * 
 * All storage providers must implement this interface.
 * To add a new provider, create a class implementing StorageProvider,
 * then register it in the factory (index.ts).
 */
export interface StorageProvider {
    /** Unique identifier for this provider (e.g. "local", "s3", "tencent_cos") */
    readonly name: string;

    /**
     * Upload a file and return its public URL.
     * @param file - The temporary file path from the upload middleware
     * @param destName - The target filename (e.g. randomName with extension)
     * @param mimeType - The MIME type of the file
     * @returns The publicly accessible URL of the uploaded file
     */
    upload(file: string, destName: string, mimeType: string): Promise<string>;

    /**
     * Delete a file by its URL or path.
     * @param url - The URL or path of the file to delete
     */
    delete(url: string): Promise<void>;

    /**
     * Test whether the storage provider is correctly configured.
     * @returns true if configuration is valid and connection works
     */
    testConnection?(): Promise<boolean>;
}

/**
 * Configuration schema definition for a storage provider.
 * Used to render dynamic configuration forms in the admin UI.
 */
export interface StorageConfigField {
    /** Field key (stored in system_config) */
    key: string;
    /** Display label */
    label: string;
    /** Field type: text, password, number, select */
    type: "text" | "password" | "number" | "select";
    /** Placeholder text */
    placeholder?: string;
    /** Default value */
    default?: string;
    /** For select type: available options */
    options?: { label: string; value: string }[];
    /** Whether this field is required */
    required?: boolean;
}

/**
 * Metadata for a storage provider, including its config schema.
 */
export interface StorageProviderMeta {
    name: string;
    label: string;
    description: string;
    configFields: StorageConfigField[];
}
