<script setup lang="ts">
/**
 * 头部第三个按钮:一个控件表达三种状态,顺带收走了原先散在属性面板里的「定时发布」。
 *
 * | 文章状态 | 形态 | 点击 |
 * |---|---|---|
 * | hidden    | 发布 ▼            | 主体=立即发布;▼=定时发布… |
 * | scheduled | 定时 08-01 09:00  | 打开对话框:立即发布 / 更新时间 / 取消定时 |
 * | visible   | 隐藏              | 撤下,回到草稿 |
 *
 * 移动端(<1024px)没有 `▼`(SplitButton 的下拉在窄屏不好点),改成点「发布」先弹选择。
 *
 * 状态本身就由这个按钮表达 —— 所以头部不再有单独的状态 chip。
 * 设计见 docs/editor-access-panel.md §4。
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import SplitButton from 'primevue/splitbutton';
import DatePicker from 'primevue/datepicker';
import AdminModal from '../../components/AdminModal.vue';
import { BTN, BTN_SM, DATEPICKER_PT, SPLITBUTTON_PT, TEXT } from '../../ui/presets';
import { LucideCheck, LucideClock, LucideEyeOff } from 'lucide-vue-next';

const props = defineProps<{
    status: 'hidden' | 'scheduled' | 'visible';
    /** 已排定的发布时间(scheduled 态才有意义)。 */
    publishAt: Date | null;
    loading?: boolean;
    isMobile?: boolean;
}>();

const emit = defineEmits<{
    publish: [];
    unpublish: [];
    schedule: [when: Date];
    cancelSchedule: [];
}>();

const { t, locale } = useI18n();

/** 定时对话框:草稿态用它选时间,scheduled 态用它改时间/立即发布/取消。 */
const dialogOpen = ref(false);
const draftWhen = ref<Date | null>(null);
/** 移动端的「立即 / 定时」二选一。 */
const chooserOpen = ref(false);

/** 防御:上游若漏了归一(DYAPI 的空 Date 是字符串 `"null"`),这里也不让 Invalid Date 漏出去。 */
const validAt = computed(() => {
    const v: any = props.publishAt;
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
});

const timeLabel = computed(() => {
    if (!validAt.value) return '';
    return validAt.value.toLocaleString(locale.value === 'zh' ? 'zh-CN' : 'en-US', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
});

/**
 * SplitButton 的下拉项:目前只有「定时发布…」。
 * 不给 `icon` —— PrimeVue 的 menu icon 走 PrimeIcons 的 class,本项目没装那套字体图标,
 * 传了也是空图标位;而自定义 item 模板要依赖 TieredMenu 的 slot 内部约定,不值得为一个图标去赌。
 */
const menuItems = computed(() => [
    { label: t('action.schedule'), command: () => openDialog() },
]);

function openDialog() {
    // 打开时带上现有时间(scheduled 态),否则默认一小时后 —— 空着让人不知道该填什么格式。
    draftWhen.value = validAt.value ? new Date(validAt.value) : new Date(Date.now() + 60 * 60 * 1000);
    dialogOpen.value = true;
}

function onMainClick() {
    if (props.status === 'visible') { emit('unpublish'); return; }
    if (props.status === 'scheduled') { openDialog(); return; }
    if (props.isMobile) { chooserOpen.value = true; return; }
    emit('publish');
}

function confirmSchedule() {
    if (!draftWhen.value) return;
    emit('schedule', draftWhen.value);
    dialogOpen.value = false;
}

function publishNow() {
    dialogOpen.value = false;
    chooserOpen.value = false;
    emit('publish');
}
</script>

<template>
    <!-- 已发布:单按钮「隐藏」 -->
    <Button v-if="status === 'visible'" unstyled @click="onMainClick" :disabled="loading" :class="BTN.danger">
        <LucideEyeOff :size="16" /> {{ $t('action.unpublish') }}
    </Button>

    <!-- 定时中:按钮直接显示计划时间,点击进对话框 -->
    <Button v-else-if="status === 'scheduled'" unstyled @click="onMainClick" :disabled="loading" :class="BTN.secondary">
        <LucideClock :size="16" /> {{ $t('contentStatus.scheduled') }} {{ timeLabel }}
    </Button>

    <!-- 草稿:PC 用 SplitButton(主体发布 + ▼ 定时);移动端退化成普通按钮 + 选择弹框 -->
    <Button v-else-if="isMobile" unstyled @click="onMainClick" :disabled="loading" :class="BTN.primary">
        <LucideCheck :size="16" /> {{ $t('action.publish') }}
    </Button>
    <SplitButton v-else :model="menuItems" @click="onMainClick" :disabled="loading" unstyled :pt="SPLITBUTTON_PT">
        <LucideCheck :size="16" /> {{ $t('action.publish') }}
    </SplitButton>

    <!-- 移动端:立即 / 定时 二选一 -->
    <AdminModal v-if="chooserOpen" :title="$t('action.publish')" widthClass="max-w-xs"
        hideSave :cancelText="$t('action.cancel')" @close="chooserOpen = false">
        <div class="flex flex-col gap-2">
            <Button unstyled @click="publishNow" :class="BTN.primary">
                <LucideCheck :size="16" /> {{ $t('action.publishNow') }}
            </Button>
            <Button unstyled @click="chooserOpen = false; openDialog()" :class="BTN.secondary">
                <LucideClock :size="16" /> {{ $t('action.schedule') }}
            </Button>
        </div>
    </AdminModal>

    <!-- 选时间 / 改时间 / 取消定时 -->
    <AdminModal v-if="dialogOpen" :title="$t('action.schedule')" widthClass="max-w-sm"
        hideSave :cancelText="$t('action.close')" @close="dialogOpen = false">
        <p v-if="status === 'scheduled'" class="mb-3" :class="TEXT.muted">
            {{ $t('article.scheduledAt', { time: timeLabel }) }}
        </p>
        <DatePicker v-model="draftWhen" showTime hourFormat="24" dateFormat="yy-mm-dd" unstyled
            :pt="DATEPICKER_PT" class="w-full" />
        <div class="mt-4 flex flex-wrap gap-2">
            <Button unstyled @click="confirmSchedule" :disabled="!draftWhen" :class="BTN_SM.primary">
                {{ status === 'scheduled' ? $t('action.updateSchedule') : $t('action.schedule') }}
            </Button>
            <Button unstyled @click="publishNow" :class="BTN_SM.secondary">{{ $t('action.publishNow') }}</Button>
            <Button v-if="status === 'scheduled'" unstyled @click="dialogOpen = false; emit('cancelSchedule')"
                :class="[BTN_SM.danger, 'ml-auto']">
                {{ $t('action.cancelSchedule') }}
            </Button>
        </div>
    </AdminModal>
</template>
