import { F } from "dyapi/core/datafield.js";
import { Model } from "dyapi/core/model.js";
import { CRUD, Inject } from "dyapi/utils/decorators.js";
import { ForbiddenError } from "dyapi/utils/error.js";
import testContainer from "../containers/testContainer.js";
import { getBreadcrumbs, getChildren } from "../utils/contentHelpers.js";
import { audience } from "../services/AudienceService.js";
import { hooks } from "../services/HookManager.js";

/**
 * Category Model for Category Management
 * Only super_admin can manage Categories.
 */
@CRUD("categories")
export default class CategoryModel extends Model {
    @Inject(testContainer) declare container;

    tablename = "categories";
    datafields = [
        F.String("name").notNull(),
        F.String("slug").notNull().unique(),
        F.Number("parent_id").default(0),
        F.String("list_template"), // Vue template for the list page (leave empty to not render)
        F.String("content_template"), // Vue template for the individual category content
        F.Number("weight").default(50),  // Order
        // 受众轴(公开站门禁,见 docs/public-access.md):栏目是受众声明的主场,文章可覆盖。
        F.String("audience").default("public"), // public | authenticated | restricted
        F.Number("teaser").default(0),          // 受限时摘要是否仍进公开列表(0 隐身 / 1 摘要墙)
        F.Object("article_data_fields").default({}),
        /**
         * 给本分类文章的**作者**看的一段 markdown,渲染在文章编辑器的正文上方。
         *
         * 自定义字段有 title 能自解释,而"正文里要按什么格式写"过去没有任何地方能说 ——
         * neo 主题的成员页要求正文里有一个 `:::works` 块,不写在这里就只能靠口口相传。
         */
        F.String("editor_hint"),
        F.Object("data").default({}), // Additional JSON data。空态是空袋子 `{}`,不是 NULL
    ];
    permission = {
        // 受众轴:匿名不再能读全表(以前 PUBLIC:"R" 会把所有栏目的名字/slug/层级泄漏出去,
        // 包括受限栏目)。公开侧统一走 `GET /api/content/categories`,它按受众过滤;api.ts 的
        // crudAPI shim 把 `getList('categories')` 重定向过去,主题零改动。见 docs/public-access.md。
        "PUBLIC": "",
        "DEFAULT": "R",
        "super_admin": "C,R,U,D"
    };

    /**
     * 受众轴:栏目的 audience/teaser/parent_id 变了,该栏目**整棵子树**下的文章派生值全部过期
     * → 批量重算(见 docs/public-access.md §3)。不重算等于门禁静默失效。
     *
     * 只在这三个字段真的出现在本次写入里时才重算——改个名字/权重不该扫全子树。
     */
    async update(param, item) {
        const affectsAudience =
            item?.audience !== undefined || item?.teaser !== undefined || item?.parent_id !== undefined;
        /**
         * 什么时候要通知公开站重算这个栏目:
         *
         * - `slug`          决定其下**每一篇文章**的 URL(`/a/<栏目slug>/<文章slug>`)
         * - `list_template` 决定这个栏目有没有列表页
         * - `audience`/`teaser`/`parent_id` 决定这张列表页**还能不能给匿名访客看**
         *
         * 最后一组尤其要紧:栏目一旦收紧,那张列着全部文章标题的旧列表页仍在磁盘上 ——
         * 文章正文清掉了,标题却还在裸奔。此前这条路径只重算文章、不碰栏目页自己。
         */
        const affectsUrls = item?.slug !== undefined || item?.list_template !== undefined || affectsAudience;

        const ids = (affectsAudience || affectsUrls)
            ? (param?.id != null
                ? [param.id]
                : (await this.read({ ...param, fields: ["id"], limit: 100000 })).map((c: any) => c.id))
            : [];

        const result = await super.update(param, item);

        if (affectsAudience) {
            for (const id of ids) await audience.recomputeSubtree(id);
        }
        if (affectsUrls) {
            for (const id of ids) await hooks.doAction(`content.saved.${this.tablename}`, id);
        }
        return result;
    }

    /**
     * Category trees are small and admin pickers fetch them all at once — lift the default cap.
     *
     * 并补上受众轴的**继承计算结果**(`audience_eff`/`teaser_eff`/`access_eff`/`*_from`)。
     * 后台若只看到本栏目自己填的 audience,一个自身设为 public、实际被祖先限制的栏目会让作者
     * 完全误判 —— 而"继承算出来是什么"只有后端的纯函数知道,不能让 UI 再实现一遍。
     */
    async HTTPReadMany(state, query, body) {
        state.settingsOverrides.maxLimit = 9999;
        const res: any = await super.HTTPReadMany(state, query, body);
        if (res?.data) await audience.annotateCategories(res.data);
        return res;
    }

    async HTTPReadOne(state, query, body) {
        const res: any = await super.HTTPReadOne(state, query, body);
        if (res?.data) await audience.annotateCategories([res.data]);
        return res;
    }

    /**
     * 处理单条分类详情，添加关联数据
     */
    async enrichCategoryData(category: any) {
        // 如果 list_template 为空，则不支持列表页渲染
        if (!category.list_template || category.list_template.trim() === "") {
            throw new ForbiddenError("This category does not support list view.");
        }

        // 获取面包屑、子分类和文章列表
        const breadcrumbs = await getBreadcrumbs(category.id, this);
        const children = await getChildren(category.id, this);

        return {
            ...category,
            children,
            breadcrumbs,
        };
    }

    /**
     * 重写 HTTPReadOne，支持 {slug} 格式查询
     */
    // @ts-ignore - 重写基类方法以支持 slug 查询
    async HTTPReadOne(state, query, body) {
        // 如果 id 是 {slug} 格式，提取 slug 并转为 filter 查询
        if (query.id !== undefined && typeof query.id === 'string' && query.id.startsWith('{') && query.id.endsWith('}')) {
            const slug = query.id.slice(1, -1); // 去掉首尾大括号
            query.filter = { slug };
            delete query.id;
        }

        const originalResult = await super.HTTPReadOne(state, query, body);

        // 组装完整内容数据
        const enrichedData = await this.enrichCategoryData(originalResult.data);

        return {
            code: 200,
            data: enrichedData
        };
    }
}
