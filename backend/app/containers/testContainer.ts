import path from "path"
import process from "process";
import { SQLiteContainer } from "dyapi/containers/SqliteContainer.dyapi.js";
/*
export default class testContainer extends JsonContainer {
    filename = path.join(process.cwd(), "./data/test.json");
}*/


export default class testContainer extends SQLiteContainer {
    filename = path.join(process.cwd(), "./data/test.db");
}