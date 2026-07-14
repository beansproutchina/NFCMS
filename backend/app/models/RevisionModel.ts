import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, PopTarget, Inject } from "dyapi/utils/decorators.js";
import testContainer from "../containers/testContainer.js";

/**
 * Immutable content revision snapshots. Written only via RevisionService (raw create),
 * never through the HTTP CRUD path (no C/U/D granted). Contains unpublished content,
 * so it must never be publicly listable.
 */
@CRUD("revisions")
@PopTarget("uid")
export default class RevisionModel extends Model {
    @Inject(testContainer) declare container;
    tablename = "revisions";
    datafields = [
        F.String("content_type").notNull(),   // target tablename, e.g. "articles"
        F.String("content_id").notNull(),      // stringified target row id
        F.Number("version_no").notNull(),
        F.Object("data"),                       // full field snapshot
        F.String("author_id"),
        F.String("note"),
        F.String("status_at_snapshot"),
        F.Date("created_at"),
    ];
    permission = {
        "PUBLIC": "",
        "DEFAULT": "",
        "admin": "R",
        "super_admin": "R,D"
    };
}
