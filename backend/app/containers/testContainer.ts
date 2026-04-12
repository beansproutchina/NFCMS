import path from "path"
import process from "process";
import { JsonContainer } from "dyapi/containers/JsonContainer.dyapi.js";

export default class testContainer extends JsonContainer {
    filename = path.join(process.cwd(), "./data/test.json");
}