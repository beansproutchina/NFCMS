<template>
    <!-- Unified Header -->
    <footer class="w-full bg-[#f5f5f7] border-t border-[#d2d2d7] py-10 px-6 mt-auto">
        <div class="max-w-[980px] mx-auto flex flex-col md:flex-row justify-between items-center text-[12px] text-[rgba(0,0,0,0.48)] tracking-[-0.12px] leading-[1.33]">
            <div class="mb-4 md:mb-0">
                &copy; {{ new Date().getFullYear() }} {{ config?.site_name || 'NFCMS' }}. All rights reserved.
            </div>
            <div class="flex gap-4 items-center">
                <span>Proudly powered by <a href="https://github.com/beansproutchina/NFCMS" target="_blank" class="text-[#424245] hover:text-[#000000] hover:underline transition-colors">NFCMS</a></span>
                <span v-if="config?.icp_record" class="border-l border-[#d2d2d7] pl-4">
                    <a href="https://beian.miit.gov.cn/" target="_blank" class="hover:text-[#000000] hover:underline transition-colors">{{ config.icp_record }}</a>
                </span>
            </div>
        </div>
    </footer>

</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
const props = defineProps<{ context: any }>();
const { config } = props.context || {};


</script>