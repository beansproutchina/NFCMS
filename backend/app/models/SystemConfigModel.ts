import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { Inject } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";

// Removed @CRUD("systemconfig") so it's fully managed via SystemController
export default class SystemConfigModel extends Model{
    @Inject(testContainer) declare container;
    tablename = "system_config";
    datafields = [
        F.String("key").unique().notNull(),
        F.String("value"),
    ];
    permission = { // Internal model now, API not exposed directly
        "PUBLIC": "RO",
        "DEFAULT": "R",
        "super_admin": "C,R,U,D",
    };
}
