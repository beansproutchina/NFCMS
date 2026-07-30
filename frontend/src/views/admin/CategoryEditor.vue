<template>
  <AdminModal :title="isEditing ? $t('action.edit') : $t('action.new')" widthClass="max-w-lg" @close="emit('close')" @save="save">
    <form @submit.prevent="save" class="space-y-4" id="category-form">
      <div>
        <label :class="LABEL">{{ $t('form.name') }}</label>
        <InputText v-model="formData.name" unstyled :class="INPUT_CLASS" />
      </div>

      <div>
        <label :class="LABEL">{{ $t('form.slug') }}</label>
        <InputText v-model="formData.slug" unstyled :class="INPUT_CLASS" />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label :class="LABEL">{{ $t('form.list_template') || 'List Template' }}</label>
          <InputText v-model="formData.list_template" unstyled placeholder="e.g. ListTemplate1" :class="INPUT_CLASS" />
        </div>
        <div>
          <label :class="LABEL">{{ $t('form.content_template') }}</label>
          <InputText v-model="formData.content_template" unstyled placeholder="e.g. ContentTemplate1" :class="INPUT_CLASS" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label :class="LABEL">{{ $t('form.parent_id') }}</label>
          <Select v-model="formData.parent_id" :options="categoryOptions" optionLabel="label" optionValue="value"
            unstyled :pt="SELECT_PT" class="w-full" />
        </div>
        <div>
          <label :class="LABEL">{{ $t('form.weight') }}</label>
          <InputText v-model.number="formData.weight" unstyled :class="INPUT_CLASS" />
        </div>
      </div>

      <!-- 受众轴:谁能在公开站看到本栏目下的内容(见 docs/public-access.md) -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label :class="LABEL">{{ $t('access.audience') }}</label>
          <Select v-model="formData.audience" :options="audienceOptions" optionLabel="label" optionValue="value"
            unstyled :pt="SELECT_PT" class="w-full" />
        </div>
        <!-- 显隐按**有效受众**判断:本栏目自己填 public、但祖先受限时,摘要墙依然有意义。
             只看 formData.audience 会把这个开关藏起来,作者根本不知道它存在。 -->
        <div v-if="effectiveAudience !== 'public'" class="flex items-center justify-between pb-2 self-end w-full">
          <label :class="LABEL_BARE">{{ $t('access.teaser') }}</label>
          <Checkbox unstyled v-model="formData.teaser" :true-value="1" :false-value="0" binary :pt="CHECKBOX_PT" />
        </div>
      </div>
      <!-- 继承结果:由后端算好下发(audience_eff/teaser_eff/*_from),前端只负责说成人话。 -->
      <p v-if="effectiveText" :class="TEXT.caption" class="flex items-start gap-1.5">
        <LucideCornerDownRight :size="14" class="shrink-0 mt-0.5 opacity-50" />
        <span>{{ effectiveText }}</span>
      </p>
      <p :class="TEXT.caption">
        {{ $t('access.audienceHint') }}
        <template v-if="effectiveAudience !== 'public'"> {{ $t('access.teaserHint') }}</template>
      </p>

      <!-- Article Data Fields Editor -->
      <div>
        <label :class="LABEL">{{ $t('form.articleDataFields') }}</label>
        <p class="mb-2" :class="TEXT.caption">{{ $t('form.articleDataFieldsDesc') }}</p>
        <div class="border rounded-control border-separator p-3 bg-white max-h-60 overflow-y-auto space-y-2">
          <div v-for="(field, idx) in formData.articleFieldDefs" :key="idx" class="flex gap-2 items-start">
            <div class="w-1/4">
              <InputText v-model="field.key" unstyled placeholder="Key"
                class="w-full h-8 px-2 border border-separator rounded-chip text-small focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <div class="w-1/4">
              <InputText v-model="field.title" unstyled :placeholder="$t('form.fieldTitle')"
                class="w-full h-8 px-2 border border-separator rounded-chip text-small focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <div class="w-1/4">
              <Select v-model="field.type" :options="fieldTypeOptions" optionLabel="label" optionValue="value" unstyled
                :pt="{ root: 'w-full h-8 px-2 border border-separator rounded-chip text-small focus:outline-none focus:ring-1 focus:ring-accent flex items-center justify-between cursor-pointer relative bg-white', label: 'text-small truncate', dropdown: 'w-3 h-3 opacity-50 absolute right-1 top-1/2 -translate-y-1/2', overlay: 'bg-white border border-separator rounded-chip shadow-lg mt-1 py-1 z-9999', option: ({ context }: any) => ({ class: ['px-2 py-1 text-small cursor-pointer hover:bg-canvas', context.selected ? 'bg-accent text-white' : 'text-label'] }) }" />
            </div>
            <Button type="button" @click="formData.articleFieldDefs.splice(idx, 1)" unstyled
              class="text-small px-2 mt-1" :class="BTN_REMOVE">X</Button>
          </div>
          <Button type="button"
            @click="formData.articleFieldDefs.push({ key: '', title: '', type: 'text' })"
            unstyled class="mt-1" :class="LINK.small">+ {{ $t('action.new') }}</Button>
        </div>
      </div>

      <div>
        <label :class="LABEL">{{ $t('form.extraData')}}</label>
        <div class="border rounded-control border-separator p-2 bg-white  max-h-40 overflow-y-auto ">
          <div v-for="(item, idx) in formData.metaPairs" :key="idx" class="flex gap-2 mb-2">
            <InputText v-model="item.key" unstyled placeholder="Key"
              class="w-1/3 h-8 px-2 border border-separator rounded-chip text-small focus:outline-none focus:ring-1 focus:ring-accent" />
            <InputText v-model="item.value" unstyled placeholder="Value"
              class="flex-1 h-8 px-2 border border-separator rounded-chip text-small focus:outline-none focus:ring-1 focus:ring-accent" />
            <Button type="button" @click="formData.metaPairs.splice(idx, 1)" unstyled
              class="text-small px-2" :class="BTN_REMOVE">X</Button>
          </div>
          <Button type="button"
            @click="formData.metaPairs = formData.metaPairs || []; formData.metaPairs.push({ key: '', value: '' })"
            unstyled class="mt-1" :class="LINK.small">+ {{ $t('action.new') }}</Button>
        </div>
      </div>
      <button type="submit" class="hidden"></button>
    </form>

    <div v-if="isEditing && formData.id" class="mt-6 pt-5 border-t border-separator-weak">
      <AclEditor model="articles_category" :resource-id="formData.id" :actions="['C', 'R', 'U', 'D', 'publish']"
        :title="$t('acl.categoryArticles')" :inherited="inheritedManageGrants" />
      <p class="mt-2" :class="TEXT.caption">{{ $t('acl.categoryArticlesHint') }}</p>
    </div>

    <!-- 受众轴的授权:按**有效受众**判断是否需要(祖先设成 restricted 时,本栏目也在名单管辖内)。
         与上面的分类授权同构,只是合成 model 与动作不同 —— 所以 AclEditor 零改造复用。 -->
    <div v-if="isEditing && formData.id && effectiveAudience === 'restricted'" class="mt-6 pt-5 border-t border-separator-weak">
      <AclEditor model="articles_audience" :resource-id="formData.id" :actions="['V']"
        :title="$t('acl.categoryAudience')" :inherited="inheritedViewGrants" />
      <p class="mt-2" :class="TEXT.caption">{{ $t('acl.categoryAudienceHint') }}</p>
    </div>
  </AdminModal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AdminModal from '../../components/AdminModal.vue';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import { BTN_REMOVE, CHECKBOX_PT, INPUT_CLASS, LABEL, LABEL_BARE, LINK, SELECT_PT, TEXT } from '../../ui/presets';
import AclEditor from '../../components/AclEditor.vue';
import { categoryAudienceOptions, effectiveAudienceText } from '../../ui/audience';
import { aclAPI, ARTICLES_CATEGORY, ARTICLES_AUDIENCE } from '../../api';
import { LucideCornerDownRight } from 'lucide-vue-next';

const { t } = useI18n();
const props = defineProps<{
  initialData: any;
  isEditing: boolean;
  categories: any[];
}>();

const emit = defineEmits(['save', 'close']);

const formData = ref<any>({});

// 受众轴:三级 + 摘要墙开关(见 docs/public-access.md §2)
const audienceOptions = categoryAudienceOptions(t);

/**
 * 有效受众 = 沿父链继承后的结果,**由后端算**(`audience_eff`)。
 *
 * 编辑中改了本栏目的 audience 时,后端那份还是保存前的值 —— 所以取"两者里更严的一个"作为显示
 * 依据:本栏目一旦自己选了非 public,开关必须出现;祖先施加了限制时也必须出现。
 */
const SEVERITY: Record<string, number> = { public: 0, authenticated: 1, restricted: 2 };
const effectiveAudience = computed(() => {
  const own = formData.value.audience || 'public';
  const inherited = props.initialData?.audience_eff || 'public';
  return (SEVERITY[own] ?? 0) >= (SEVERITY[inherited] ?? 0) ? own : inherited;
});

/**
 * 祖先分类上的授权 —— 它们**级联到本栏目**却不显示在本栏目的授权列表里,于是作者看到"暂无授权"
 * 却实际已被授权,是和 audience 继承一样的"看不见的配置"问题。这里把祖先的授权取来只读展示。
 *
 * 父链深度通常 ≤3,所以直接按链逐个取;都是只读展示,不值得为它加后端接口。
 */
const inheritedManageGrants = ref<any[]>([]);
const inheritedViewGrants = ref<any[]>([]);

/** 本栏目的祖先链(不含自己),root → parent。 */
const ancestors = computed(() => {
  const byId = new Map(props.categories.map((c: any) => [Number(c.id), c]));
  const out: any[] = [];
  const seen = new Set<number>();
  let id = Number(formData.value.parent_id) || 0;
  while (id > 0 && byId.has(id) && !seen.has(id)) {
    seen.add(id);
    const cat = byId.get(id)!;
    out.unshift(cat);
    id = Number(cat.parent_id) || 0;
  }
  return out;
});

const loadInheritedGrants = async () => {
  inheritedManageGrants.value = [];
  inheritedViewGrants.value = [];
  if (!props.isEditing || !formData.value.id) return;
  for (const anc of ancestors.value) {
    for (const [model, bucket] of [[ARTICLES_CATEGORY, inheritedManageGrants], [ARTICLES_AUDIENCE, inheritedViewGrants]] as const) {
      try {
        const res: any = await aclAPI.list(model, anc.id);
        for (const g of res.data || []) bucket.value.push({ ...g, _fromName: anc.name });
      } catch { /* 无权或空:忽略,只是不展示继承项 */ }
    }
  }
};

watch(() => [props.isEditing, formData.value.id, ancestors.value.map((a: any) => a.id).join(',')],
      loadInheritedGrants, { immediate: true });

/** 只在"限制来自祖先"时才有话可说(自身决定时后端给的 *_from 是 null)。 */
const effectiveText = computed(() => {
  const cat = props.initialData;
  if (!cat?.audience_from && !cat?.teaser_from) return '';
  return effectiveAudienceText(t, cat);
});

const fieldTypeOptions = [
  { label: t('form.fieldTypeText'), value: 'text' },
  { label: t('form.fieldTypeTextarea'), value: 'textarea' },
  { label: t('form.fieldTypeNumber'), value: 'number' },
  { label: t('form.fieldTypeAttachment'), value: 'attachment' },
];

const categoryOptions = computed(() => {
  const opts = [{ label: t('form.none') || 'None (Root)', value: 0 }];
  props.categories.forEach(c => {
    if (c.id !== formData.value.id) {
      opts.push({ label: c.name, value: c.id });
    }
  });
  return opts;
});

watch(() => props.initialData, (newVal) => {
  formData.value = { ...newVal };
  // 新建分类时后端字段默认值还没下发过来 —— 显式兜底,免得 Select 空着。
  if (!formData.value.audience) formData.value.audience = 'public';
  formData.value.teaser = Number(formData.value.teaser) === 1 ? 1 : 0;

  // Convert article_data_fields from object to array of definitions
  const fieldDefs: { key: string; title: string; type: string }[] = [];
  if (newVal.article_data_fields && typeof newVal.article_data_fields === 'object') {
    const src = typeof newVal.article_data_fields === 'string'
      ? JSON.parse(newVal.article_data_fields)
      : newVal.article_data_fields;
    for (const [key, def] of Object.entries(src)) {
      const d = def as any;
      fieldDefs.push({ key, title: d.title || '', type: d.type || 'text' });
    }
  }
  formData.value.articleFieldDefs = fieldDefs;
}, { immediate: true });

const save = () => {
  // Convert articleFieldDefs array back to article_data_fields object
  const articleDataFields: Record<string, { title: string; type: string }> = {};
  if (formData.value.articleFieldDefs) {
    for (const field of formData.value.articleFieldDefs) {
      if (field.key && field.key.trim()) {
        articleDataFields[field.key.trim()] = { title: field.title || '', type: field.type || 'text' };
      }
    }
  }
  formData.value.article_data_fields = articleDataFields;
  delete formData.value.articleFieldDefs;

  emit('save', formData.value);
};
</script>
