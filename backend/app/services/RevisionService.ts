import RevisionModel from "../models/RevisionModel.js";

/**
 * RevisionService — content version history.
 *
 * Snapshots the FULL post-image of a content row into the `revisions` table on each
 * user-facing save (HTTP create/update) and lifecycle transition. `rollback` restores
 * a prior version's CONTENT fields (never the lifecycle fields status/publish_at), and
 * snapshots the current state first so a rollback is itself undoable.
 *
 * Stateless: reaches the RevisionModel via the content model's `_app` (model._app.I(...)).
 */
class RevisionService {
    private rm(model: any) {
        return model._app.I(RevisionModel);
    }

    async snapshot(model: any, id: any, authorId: any, note?: string): Promise<number | null> {
        const row = (await model.read({ id }))[0];
        if (!row) return null;
        const data = { ...row };
        delete data.id;

        const rm = this.rm(model);
        const latest = (await rm.read({
            filter: { $and: { content_type: model.tablename, content_id: String(id) } },
            orderBy: "version_no",
            orderDesc: true,
            limit: 1,
        }))[0];
        const version_no = ((latest?.version_no as number) ?? 0) + 1;

        await rm.create({
            content_type: model.tablename,
            content_id: String(id),
            version_no,
            data,
            author_id: authorId != null ? String(authorId) : "",
            note: note || "",
            status_at_snapshot: row.status ?? "",
            created_at: new Date(),
        });
        return version_no;
    }

    async list(model: any, id: any): Promise<any[]> {
        return await this.rm(model).read({
            filter: { $and: { content_type: model.tablename, content_id: String(id) } },
            orderBy: "version_no",
            orderDesc: true,
        });
    }

    async get(model: any, id: any, versionNo: any): Promise<any> {
        return (await this.rm(model).read({
            filter: { $and: { content_type: model.tablename, content_id: String(id), version_no: Number(versionNo) } },
        }))[0];
    }

    /** Restore content fields of `versionNo` onto the live row. Leaves status/publish_at untouched. */
    async rollback(model: any, id: any, versionNo: any, authorId: any): Promise<boolean> {
        const rev = await this.get(model, id, versionNo);
        if (!rev) return false;
        await this.snapshot(model, id, authorId, `pre-rollback (to v${versionNo})`);

        const data = typeof rev.data === "string" ? JSON.parse(rev.data) : rev.data;
        const lifecycle: string[] = model.lifecycleFields || [];
        const restore: any = {};
        for (const f of model.datafields) {
            const n = f.name;
            if (n === "id" || lifecycle.includes(n)) continue;
            if (n in (data || {})) restore[n] = data[n];
        }
        await model.update({ id }, restore);
        await this.snapshot(model, id, authorId, `rollback to v${versionNo}`);
        return true;
    }

    diff(a: any, b: any): Array<{ field: string; from: any; to: any }> {
        const da = typeof a?.data === "string" ? JSON.parse(a.data) : a?.data || {};
        const db = typeof b?.data === "string" ? JSON.parse(b.data) : b?.data || {};
        const keys = new Set([...Object.keys(da), ...Object.keys(db)]);
        const out: Array<{ field: string; from: any; to: any }> = [];
        for (const k of keys) {
            if (JSON.stringify(da[k]) !== JSON.stringify(db[k])) out.push({ field: k, from: da[k], to: db[k] });
        }
        return out;
    }
}

export const revisions = new RevisionService();
