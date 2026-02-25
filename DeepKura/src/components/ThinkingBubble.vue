<script setup lang="ts">
import { } from 'lucide-vue-next';
</script>

<template>
  <div class="relative flex gap-0 md:gap-4 mb-6 flex-row animate-pulse">
    
    <!-- AI Avatar Only -->
    <div class="absolute top-0 left-3.5 md:static shrink-0 w-8 h-8 md:w-10 md:h-10 flex items-start justify-end pt-1">
      <img src="/logo.svg" alt="Thinking..." class="w-8 h-8 md:w-10 md:h-10 object-contain" />
    </div>

    <!-- Bubble -->
    <div class="max-w-[95%] md:max-w-[85%] min-w-0">
        <div class="text-gray-800 dark:text-gray-100 pl-0 pr-1 py-1 ml-10 md:ml-0">
             <div class="flex items-center gap-1.5 h-6">
                 <span class="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                 <span class="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                 <span class="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce"></span>
             </div>
        </div>
    </div>

  </div>
</template>
