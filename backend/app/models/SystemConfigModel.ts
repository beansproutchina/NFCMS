import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, Inject } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";

@CRUD("systemconfig")
export default class SystemConfigModel extends Model{
    @Inject(testContainer) declare container;
    tablename = "system_config";
    datafields = [
        F.String("key").unique().notNull(),
        F.String("value"),
    ];
    permission = {
        "PUBLIC": "RO",
        "DEFAULT": "R",
        "admin": "C,R,U,D",
    };
}
