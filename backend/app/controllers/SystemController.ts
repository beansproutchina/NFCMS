import { ControllerRoute, Route, Inject, ValidateBody } from "dyapi/utils/decorators.js";
import { Controller } from "dyapi/core/controller.js";
import UserModel from "../models/UserModel.js";
import SystemConfigModel from "../models/SystemConfigModel.js";
import CategoryModel from "../models/CategoryModel.js";

const VALID_CONFIG_KEYS = [
    "is_initialized",
    "site_name",
    "subtitle",
    "icp_record",
    "mourning_mode",
    "home_template"
];

let globalConfigCache: Record<string, string> | null = null;

@ControllerRoute("system")
export default class SystemController extends Controller {
    @Inject(UserModel) declare userModel: UserModel;
    @Inject(SystemConfigModel) declare configModel: SystemConfigModel;
    @Inject(CategoryModel) declare categoryModel: CategoryModel;

    async ensureConfigLoaded() {
        if (globalConfigCache === null) {
            globalConfigCache = {};
            const allConfig = await this.configModel.read({});
            for (const item of allConfig) {
                if (VALID_CONFIG_KEYS.includes(item.key)) {
                    globalConfigCache[item.key] = item.value;
                }
            }
            for (const key of VALID_CONFIG_KEYS) {
                if (globalConfigCache[key] === undefined) {
                    globalConfigCache[key] = "";
                }
            }
        }
    }

    @Route("get", "/config")
    async getConfig(ctx) {
        await this.ensureConfigLoaded();
        return { code: 200, data: globalConfigCache };
    }

    @Route("post", "/config")
    async updateConfig(ctx) {
        if (ctx.state.user?.role !== "super_admin") {
            return { code: 403, message: "Permission Denied. super_admin required." };
        }
        
        await this.ensureConfigLoaded();
        const payload = ctx.request.body;
        
        const updates = [];
        for (const key of VALID_CONFIG_KEYS) {
            if (key === "is_initialized") continue;

            if (payload[key] !== undefined && payload[key] !== globalConfigCache[key]) {
                const val = payload[key] + "";
                globalConfigCache![key] = val;
                updates.push({ key, value: val });
            }
        }
        
        for (const { key, value } of updates) {
            const exist = await this.configModel.read({ filter: { key } });
            if (exist && exist.length > 0) {
                await this.configModel.update({ id: exist[0].id }, { value });
            } else {
                await this.configModel.create({ key, value });
            }
        }

        return { code: 200, message: "Configuration updated successfully." };
    }

    @Route("get", "/status")
    async status() {
        await this.ensureConfigLoaded();
        const isInitialized = globalConfigCache!["is_initialized"] === "true";
        return { code: 200, data: { is_initialized: isInitialized } };
    }

    @Route("post", "/restart")
    async restart(ctx) {
        if (ctx.state.user?.role !== "super_admin") {
            return { code: 403, message: "Permission Denied. super_admin required." };
        }
        
        console.log("Server restart triggered by super_admin");
        setTimeout(() => { process.exit(0); }, 1000);
        return { code: 200, message: "Server is restarting..." };
    }

    @Route("post", "/setup")
    @ValidateBody({
        siteName: "string",
        adminUsername: "string",
        adminPassword: "string"
    })
    async setup(ctx) {
        const { siteName, adminUsername, adminPassword } = ctx.request.body;
        await this.ensureConfigLoaded();

        if (globalConfigCache!["is_initialized"] === "true") {
            return { code: 403, message: "System is already initialized." };
        }

        await this.userModel.create({
            username: adminUsername,
            password: adminPassword,
            role: "super_admin"
        });

        await this.configModel.create({ key: "is_initialized", value: "true" });
        await this.configModel.create({ key: "site_name", value: siteName });
        
        globalConfigCache!["is_initialized"] = "true";
        globalConfigCache!["site_name"] = siteName;

        await this.categoryModel.create({
            name: "Default",
            slug: "default",
            parent_id: 0,
            weight: 50
        });

        return { code: 200, message: "Setup completed successfully." };
    }
}
