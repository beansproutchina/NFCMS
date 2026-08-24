import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { Inject } from "dyapi/utils/decorators.js";
import { Locked } from "dyapi/utils/lock.js";
import { BadRequestError} from "dyapi/utils/error.js";
import testContainer from "../containers/testContainer.js";

// Removed @CRUD("systemconfig") so it's fully managed via SystemController
export default class SystemConfigModel extends Model {
    @Inject(testContainer) declare container;
    tablename = "system_config";
    datafields = [
        F.String("configkey").unique().notNull(),
        F.String("configvalue"),
    ];

    permission = { // Internal model now, API not exposed directly
        "PUBLIC": "RO",
        "DEFAULT": "R",
        "super_admin": "C,R,U,D",
    };

    async GetConfig() {
        return Locked("system_config_cache", async () => {
            if (globalConfigCache == null) {
                globalConfigCache = {};
                const allConfig = await this.read({});
                for (const item of allConfig) {
                    // Core whitelisted keys + any theme-owned key (theme_<name>_<field>).
                    if (item.configkey in VALID_CONFIG_KEYS || isThemeConfigKey(item.configkey)) {
                        globalConfigCache[item.configkey] = item.configvalue;
                    }
                }
                for (const configkey in VALID_CONFIG_KEYS) {
                    if (globalConfigCache[configkey] === undefined) {
                        globalConfigCache[configkey] = VALID_CONFIG_KEYS[configkey];
                    }
                }
                // theme_* keys have no backend default; unset ones simply stay absent
                // (the theme supplies its own fallback via configSchema.default).
            }
            return globalConfigCache;
        })
    }

    async SetConfig(configkey: string, configvalue: string) {
        if(!(configkey in VALID_CONFIG_KEYS) && !isThemeConfigKey(configkey)){
            throw new BadRequestError(`Invalid config configkey: ${configkey}`);
        }
        const configCache = await this.GetConfig();
        if(configvalue === configCache[configkey]){
            return;
        }
        const item = await this.read({ filter: { configkey } });
        if (item.length === 0) {
            await this.create({ configkey, configvalue });
        }else{
            await this.update({ filter:{ configkey } }, { configvalue });
        }
        globalConfigCache![configkey] = configvalue;
    }

    ClearCache() {
        globalConfigCache = null;
    }
}
/**
 * Theme-owned config keys follow the convention `theme_<themename>_<field>` (e.g.
 * theme_school_logo). They are NOT whitelisted individually — any key matching this
 * pattern is accepted for get/set, so a theme can declare its own settings (via
 * `configSchema` in its theme.config.ts) without touching the backend. Lowercase +
 * digits + underscores only; must have a name segment and a field segment.
 */
export function isThemeConfigKey(key: string): boolean {
    return /^theme_[a-z0-9]+_[a-z0-9_]+$/.test(key);
}

export const VALID_CONFIG_KEYS = {
    "is_initialized" : "false",
    "site_name" : "NFCMS",
    "subtitle": "",
    "icp_record": "",
    "mourning_mode": "0",
    // Storage config (JSON: { provider, local: {...}, s3: {...}, tencent_cos: {...} })
    "storage_config": '{"provider": "local", "local": {"upload_dir": "static/uploads"}}',
};
export let globalConfigCache: Record<string, string> | null = null;
