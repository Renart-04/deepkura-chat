<script setup lang="ts">
import { useLoadingBar } from '../composables/useLoadingBar'

const { isLoading, progress } = useLoadingBar()
</script>

<template>
    <div class="fixed top-0 left-0 w-full z-[100] pointer-events-none" v-if="isLoading || progress > 0">
        <div 
            class="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-300 ease-out"
            :style="{ width: `${progress}%`, opacity: isLoading ? 1 : 0 }"
        >
            <!-- Glow effect -->
            <div class="absolute right-0 top-0 h-full w-20 bg-white/30 shadow-[0_0_10px_#3b82f6,0_0_5px_#3b82f6] transform translate-x-full"></div>
        </div>
    </div>
</template>
