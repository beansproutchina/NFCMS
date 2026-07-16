import path from "path"
import process from "process";
import { SQLiteContainer } from "dyapi/containers/SqliteContainer.dyapi.js";
import { MySQLContainer } from "dyapi/containers/MysqlContainer.dyapi.js";
import { exp } from "three/tsl";
import Bun from "bun"
/*
export default class testContainer extends JsonContainer {
    filename = path.join(process.cwd(), "./data/test.json");
}*/

/*
export default class testContainer extends SQLiteContainer {
    filename = path.join(process.cwd(), "./data/test.db");
}*/


export default class testContainer extends MySQLContainer {
    host = Bun.env.MYSQL_HOST || "localhost";
    port = parseInt( Bun.env.MYSQL_PORT) || 3306;
    user = Bun.env.MYSQL_USER || "root";
    password = Bun.env.MYSQL_PASSWORD || "";
    database = Bun.env.MYSQL_DATABASE || "nfcms";
}