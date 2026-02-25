<script setup lang="ts">
import { X } from 'lucide-vue-next';

const emit = defineEmits(['close']);

const handleClose = () => {
    emit('close');
};
</script>

<template>
  <!-- Backdrop -->
  <div 
    @click="handleClose"
    class="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200"
  >
    <!-- Modal -->
    <div 
      @click.stop
      class="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 max-w-sm w-full p-8 animate-in zoom-in-95 duration-200"
    >
      <!-- Close Button -->
      <button 
        @click="handleClose"
        class="absolute top-4 right-4 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        aria-label="Close"
      >
        <X class="w-4 h-4" />
      </button>

      <!-- Content -->
      <div class="text-center pt-2">
        <h2 class="text-xl font-medium text-gray-900 dark:text-white mb-3">
          Daily Limit Reached
        </h2>

        <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-8">
          You've used all your <strong>Kurasi Think</strong> prompts for today. <br>
          The limit resets automatically at <strong>4:00 AM</strong>.
        </p>
        
        <!-- Buttons -->
        <div class="flex flex-col gap-3">
          <button 
            @click="handleClose"
            class="w-full py-2.5 px-4 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes zoom-in-95 {
  from {
    opacity: 0;
    transform: scale(0.98);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-in.zoom-in-95 {
  animation: zoom-in-95 0.2s ease-out;
}
</style>
