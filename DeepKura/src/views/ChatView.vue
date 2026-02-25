<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Sidebar from '../components/Sidebar.vue';
import ChatInterface from '../components/ChatInterface.vue';

const isSidebarOpen = ref(true);
const currentModel = ref(localStorage.getItem('selectedModel') || 'kurasi-v1');

onMounted(() => {
  if (window.innerWidth < 768) {
    isSidebarOpen.value = false;
  }
});

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

const handleNewChat = () => {
  // Logic to reset chat
  // Logic to reset chat
};
</script>

<template>
  <div class="flex h-[100dvh] bg-white dark:bg-[#0a0a0a] overflow-hidden transition-colors duration-300">
    <Sidebar 
      :is-open="isSidebarOpen" 
      @toggle="toggleSidebar"
      @new-chat="handleNewChat"
    />
    
    <div 
      class="flex-1 flex flex-col min-w-0 relative z-0"
      :class="{'blur-sm pointer-events-none md:blur-none md:pointer-events-auto': isSidebarOpen}"
    >
       <ChatInterface 
          v-model:is-sidebar-open="isSidebarOpen" 
          v-model:current-model="currentModel"
          @toggle-sidebar="toggleSidebar"
       />
    </div>
  </div>
</template>
