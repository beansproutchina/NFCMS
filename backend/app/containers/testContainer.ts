import path from "path";
import process from "process";
import { SQLiteContainer } from "dyapi/containers/SqliteContainer.dyapi.js";
import { MySQLContainer } from "dyapi/containers/MysqlContainer.dyapi.js";

/**
 * Primary data container. Switchable via env:
 *   DB_DRIVER=sqlite (default) — zero-config local dev; file at ./data/test.db.
 *   DB_DRIVER=mysql            — production; enables real LEFT JOIN pops. Configure MYSQL_* env.
 */
const useMysql = String(process.env.DB_DRIVER || "sqlite").toLowerCase() === "mysql";

class SqliteTestContainer extends SQLiteContainer {
    filename = path.join(process.cwd(), "./data/test.db");
}

class MysqlTestContainer extends MySQLContainer {
    host = process.env.MYSQL_HOST || "localhost";
    port = parseInt(process.env.MYSQL_PORT || "3306");
    user = process.env.MYSQL_USER || "root";
    password = process.env.MYSQL_PASSWORD || "";
    database = process.env.MYSQL_DATABASE || "nfcms";
}

const testContainer: any = useMysql ? MysqlTestContainer : SqliteTestContainer;
export default testContainer;
