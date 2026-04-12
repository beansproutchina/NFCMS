import { ControllerRoute, Route, Inject, ValidateBody } from "dyapi/utils/decorators.js";
import { Controller } from "dyapi/core/controller.js";
import UserModel from "../models/UserModel.js";
import SystemConfigModel from "../models/SystemConfigModel.js";

@ControllerRoute("system")
export default class SystemController extends Controller {
    @Inject(UserModel) declare userModel: UserModel;
    @Inject(SystemConfigModel) declare configModel: SystemConfigModel;

    @Route("get", "/status")
    async status() {
        const config = await this.configModel.read({ filter: { key: "is_initialized" } });
        const isInitialized = config && config.length > 0 && config[0].value === "true";
        return { code: 200, data: { is_initialized: isInitialized } };
    }

    @Route("post", "/setup")
    @ValidateBody({
        siteName: "string",
        adminUsername: "string",
        adminPassword: "string"
    })
    async setup(ctx) {
        const { siteName, adminUsername, adminPassword } = ctx.request.body;
        
        // 1. Check if already initialized
        const config = await this.configModel.read({ filter: { key: "is_initialized" } });
        if (config && config.length > 0 && config[0].value === "true") {
            return { code: 403, message: "System is already initialized." };
        }

        // 2. Create Super Admin
        await this.userModel.create({
            username: adminUsername,
            password: adminPassword, // Model processor will hash it automatically
            role: "super_admin"
        });

        // 3. Mark as initialized and save site name
        await this.configModel.create({ key: "is_initialized", value: "true" });
        await this.configModel.create({ key: "site_name", value: siteName });

        return { code: 200, message: "Setup completed successfully." };
    }
}
