import cron from "node-cron";
import { CMSModel } from "../lib/CMSModel.js";
import { revisions } from "./RevisionService.js";
import { hooks } from "./HookManager.js";
import { isBlankDate } from "../utils/dates.js";
import { registeredModels } from "../lib/registry.js";

/**
 * SchedulerService — flips `scheduled` content to `visible` once publish_at is due.
 * Runs every minute (app-layer node-cron). Idempotent: the `status='scheduled'`
 * predicate is the guard, and an in-process lock prevents overlapping ticks.
 */
class SchedulerService {
    private running = false;

    start(app: any) {
        const timezone = app.settings.cronTimezone || "Asia/Shanghai";
        cron.schedule("* * * * *", () => this.runDuePublishes(app), { timezone });
        // Run once at boot so anything already due publishes promptly.
        this.runDuePublishes(app);
    }

    async runDuePublishes(app: any) {
        if (this.running) return;
        this.running = true;
        try {
            const models = registeredModels(app).filter(
                (m: any) =>
                    m instanceof CMSModel &&
                    Array.isArray(m.datafields) &&
                    m.datafields.some((f: any) => f.name === "status") &&
                    m.datafields.some((f: any) => f.name === "publish_at")
            );
            const nowIso = new Date().toISOString(); // dates stored as ISO text -> lexicographic compare == chronological
            for (const model of models as any[]) {
                const due = await model.read({
                    filter: { $and: { status: "scheduled", publish_at: { $lte: nowIso } } },
                });
                for (const row of due) {
                    const update: any = { status: "visible", publish_at: null };
                    // 与 ContentLifecycleController 同一条规则:首次公开才盖章,空判走 isBlankDate。
                    if (model.datafields.some((f: any) => f.name === "published_at") && isBlankDate(row.published_at)) {
                        update.published_at = new Date();
                    }
                    await model.update({ id: row.id }, update);
                    await revisions.snapshot(model, row.id, null, "scheduled publish");
                    await hooks.doAction(`content.saved.${model.tablename}`, row.id);
                    await hooks.doAction(`content.published.${model.tablename}`, row.id, row);
                    console.log(`[scheduler] published ${model.tablename}#${row.id}`);
                }
            }
        } finally {
            this.running = false;
        }
    }
}

export const scheduler = new SchedulerService();
