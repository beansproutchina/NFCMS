<template>
  <VueDraggableNext :list="items" class="space-y-2" handle=".handle" @change="emitUpdate">
    <div v-for="(item, index) in items" :key="index" class="border border-separator rounded-control bg-white overflow-hidden shadow-sm">
        <div class="flex items-center gap-3 p-3 bg-surface border-b border-separator-weak">
            <span class="handle cursor-move text-label-3 hover:text-label transition-colors">☰</span>
            <InputText unstyled v-model="item.label" :placeholder="$t('form.label') || 'Label'" :class="[INPUT_CLASS, 'flex-1 max-w-[200px]']" @input="emitUpdate"/>

            <Select v-model="item.type" :options="typeOptions" optionLabel="label" optionValue="value" @change="emitUpdate" unstyled :pt="SELECT_PT" class="w-[140px] shrink-0"/>

            <template v-if="item.type === 'category'">
                <Select v-model="item.refId" :options="categoryOptions" optionLabel="label" optionValue="value" @change="onRefChange(item)" unstyled :pt="SELECT_PT" class="flex-1 min-w-0"/>
            </template>
            <template v-else-if="item.type === 'article'">
                <Select v-model="item.refId" :options="articleOptions" optionLabel="label" optionValue="value" @change="onRefChange(item)" unstyled :pt="SELECT_PT" class="flex-1 min-w-0"/>
            </template>
            <template v-else>
                 <InputText unstyled v-model="item.url" :placeholder="$t('form.url') || 'URL (e.g. /about)'" :class="[INPUT_CLASS, 'flex-1 min-w-[200px]']" @input="emitUpdate"/>
            </template>

            <Button unstyled @click="addChild(item)" class="mx-1" :class="BTN_SM.secondary">+ {{ $t('action.addSub') || 'Sub' }}</Button>
            <Button unstyled @click="removeItem(index)" class="text-danger hover:text-white hover:bg-danger px-3 py-2 rounded-control transition-colors ml-auto focus:outline-none">✕</Button>
        </div>
        <div v-if="item.children && item.children.length" class="p-3 pl-10 bg-white">
            <MenuItemEditor :items="item.children" :categories="categories" :articles="articles" @update="emitUpdate" />
        </div>
    </div>
  </VueDraggableNext>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { VueDraggableNext } from 'vue-draggable-next';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Select from 'primevue/select';
import { BTN_SM, INPUT_CLASS, SELECT_PT } from '../../ui/presets';

const { t } = useI18n();
const props = defineProps<{ items: any[], categories: any[], articles: any[] }>();
const emit = defineEmits(['update']);

const typeOptions = computed(() => [
    { label: t('form.customUrl') || 'Custom URL', value: 'custom' },
    { label: t('form.category') || 'Category', value: 'category' },
    { label: t('form.article') || 'Article', value: 'article' }
]);

const categoryOptions = computed(() => {
    const opts = [{ label: t('form.selectCategory') || 'Select Category', value: null }];
    props.categories.forEach(c => opts.push({ label: c.name, value: c.id }));
    return opts;
});

const articleOptions = computed(() => {
    const opts = [{ label: t('form.selectArticle') || 'Select Article', value: null }];
    props.articles.forEach(a => opts.push({ label: a.title, value: a.id }));
    return opts;
});

const emitUpdate = () => {
    emit('update', props.items);
};

const addChild = (item: any) => {
    if (!item.children) item.children = [];
    item.children.push({ label: 'New Subitem', url: '/', type: 'custom', refId: null, children: [] });
    emitUpdate();
};

const removeItem = (index: number) => {
    props.items.splice(index, 1);
    emitUpdate();
};

const onRefChange = (item: any) => {
    if (item.type === 'category' && item.refId) {
        const cat = props.categories.find((c: any) => c.id === item.refId);
        if (cat) {
            item.url = `/a/${cat.slug}`;
            if (item.label === 'New Item' || item.label === 'New Subitem') item.label = cat.name;
        }
    } else if (item.type === 'article' && item.refId) {
        const art = props.articles.find((a: any) => a.id === item.refId);
        if (art) {
            item.url = `/a/article/${art.slug || art.id}`;
            if (item.label === 'New Item' || item.label === 'New Subitem') item.label = art.title;
        }
    }
    emitUpdate();
};
</script>
