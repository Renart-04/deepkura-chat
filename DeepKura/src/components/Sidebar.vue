<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { Plus, MessageSquare, Menu, Settings, Info, LogOut, LogIn, MoreHorizontal, Pin, Trash2, Moon, Sun, X, Pencil, Newspaper } from 'lucide-vue-next';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { useChat } from '../composables/useChat';
import { useTheme } from '../composables/useTheme';
import { useUserPlan } from '../composables/useUserPlan';
import { useModelUsage } from '../composables/useModelUsage';
import StockTicker from './StockTicker.vue';

const { user, logout } = useAuth();
const { chats, currentChatId, resetChat, initChat, togglePinChat, deleteChat, renameChat } = useChat();
const { isDarkMode, toggleDarkMode } = useTheme();
const { currentPlan, isKurasiUnlimited } = useUserPlan();
const { usageCount, MAX_DAILY_USAGE, refreshUsage } = useModelUsage();
const router = useRouter();
const route = useRoute();

const props = defineProps<{
  isOpen: boolean
}>();

const emit = defineEmits(['toggle', 'open-settings']);

const activeDropdownId = ref<string | null>(null);
const isSettingsOpen = ref(false);
const isInfoOpen = ref(false);
const editingChatId = ref<string | null>(null);
const editingTitle = ref('');

const handleLogout = async () => {
  await logout();
  // Don't redirect - stay on current page
};

const handleLogin = () => {
  router.push('/login');
};

const handleNewChat = async () => {
   activeDropdownId.value = null;
   isSettingsOpen.value = false;
   isInfoOpen.value = false;
   resetChat();
   router.push('/');
   if (window.innerWidth < 768) {
       emit('toggle');
   }
};

const selectChat = (id: string) => {
    activeDropdownId.value = null;
    isSettingsOpen.value = false;
    isInfoOpen.value = false;
    initChat(id);
    router.push('/');
    if (window.innerWidth < 768) {
        emit('toggle');
    }
}

const toggleDropdown = (id: string, event: Event) => {
    event.stopPropagation();
    isSettingsOpen.value = false;
    isInfoOpen.value = false;
    if (activeDropdownId.value === id) {
        activeDropdownId.value = null;
    } else {
        activeDropdownId.value = id;
    }
}

const toggleSettings = (event: Event) => {
    event.stopPropagation();
    
    // If sidebar is closed, open it first
    if (!props.isOpen) {
        emit('toggle');
    }
    
    activeDropdownId.value = null;
    isInfoOpen.value = false;
    isSettingsOpen.value = !isSettingsOpen.value;
}

const toggleInfo = (event: Event) => {
    event.stopPropagation();
    
    // If sidebar is closed, open it first
    if (!props.isOpen) {
        emit('toggle');
    }
    
    activeDropdownId.value = null;
    isSettingsOpen.value = false;
    isInfoOpen.value = !isInfoOpen.value;
}

const handlePin = async (chat: any) => {
    activeDropdownId.value = null;
    await togglePinChat(chat.id, chat.isPinned);
}

const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this chat?')) {
        activeDropdownId.value = null;
        await deleteChat(id);
    }
}

const startEdit = (chat: any) => {
    activeDropdownId.value = null;
    editingChatId.value = chat.id;
    editingTitle.value = chat.title;
    // Focus input after render
    setTimeout(() => {
        const input = document.getElementById(`edit-input-${chat.id}`);
        if (input) {
            (input as HTMLInputElement).focus();
            (input as HTMLInputElement).select();
        }
    }, 10);
}

const handleRename = async (id: string) => {
    if (editingTitle.value.trim() && editingTitle.value !== chats.value.find(c => c.id === id)?.title) {
        await renameChat(id, editingTitle.value.trim());
    }
    editingChatId.value = null;
    editingTitle.value = '';
}

const cancelEdit = () => {
    editingChatId.value = null;
    editingTitle.value = '';
}

const closeAll = () => {
    activeDropdownId.value = null;
    isSettingsOpen.value = false;
    isInfoOpen.value = false;
}


// Watch user to refresh usage when logging in
watch(user, (newUser) => {
    if (newUser) {
        refreshUsage();
    }
});

onMounted(() => {
    if (user.value) {
        refreshUsage();
    }
});
</script>

<template>
  <div @click="closeAll">
    <!-- Mobile Backdrop -->
    <div 
      v-if="isOpen" 
      @click.stop="$emit('toggle')"
      class="fixed inset-0 z-35 md:hidden bg-black/50"
    ></div>

    <!-- Sidebar -->
    <aside 
      @click.stop
      class="flex flex-col h-[100dvh] bg-[#f0f4f9] dark:bg-[#171717] border-r border-gray-200 dark:border-[#262626] transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] z-50"
      :class="[
        // Mobile: Fixed, Slide-in/out
        'fixed inset-y-0 left-0 shadow-xl md:shadow-none w-64',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        
        // Desktop: Relative, Width transition (Push content)
        'md:relative md:translate-x-0',
        isOpen ? 'md:w-64' : 'md:w-16',
        !isOpen && 'md:overflow-hidden'
      ]"
    >
      <!-- Top Section: Menu Toggle & New Chat -->
      <div class="flex flex-col gap-4 transition-all" :class="isOpen ? 'p-4' : 'p-2'">
        <div class="flex items-center justify-between mb-2" :class="{'justify-center': !isOpen && 'md:flex'}">
           <!-- Mobile Close / Desktop Toggle -->
           <button 
              @click="$emit('toggle')" 
              class="p-2 hover:bg-gray-200 dark:hover:bg-[#262626] rounded-full transition-colors text-gray-500 dark:text-gray-400"
           >
              <Menu class="w-5 h-5" />
           </button>
        </div>

        <button 
          @click="handleNewChat"
          class="flex items-center bg-[#dde3ea] hover:bg-[#d0dbe7] dark:bg-[#262626] dark:hover:bg-[#404040] text-[#1f1f1f] dark:text-gray-100 py-3 cursor-pointer shadow-sm overflow-hidden mx-auto border border-transparent dark:border-[#404040]"
          :class="[
            isOpen ? 'w-full px-4 rounded-xl' : 'w-10 h-10 justify-center rounded-full', 
          ]"
          :title="!isOpen ? 'New Chat' : ''"
          aria-label="New Chat"
        >
          <Plus class="w-5 h-5 text-gray-600 dark:text-gray-300 shrink-0" />
          <span v-if="isOpen" class="text-sm font-medium whitespace-nowrap ml-3">New Chat</span>
        </button>
      </div>

      <!-- Recent Chats Section -->
      <div v-show="isOpen" class="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar" :class="{'md:px-2': !isOpen}">
         <div v-if="isOpen" class="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-500 mt-2 mb-1 transition-opacity duration-200">Recent</div>
         
         <div 
           v-for="chat in chats" 
           :key="chat.id"
           class="relative group"
         >
             <button 
                @click="selectChat(chat.id)"
                class="flex items-center w-full p-3 hover:bg-[#dde3ea] dark:hover:bg-[#262626] rounded-full transition-colors text-left min-w-[44px]"
                :class="[
                        {'justify-center': !isOpen},
                        currentChatId === chat.id && route.path === '/' ? 'bg-[#d0dbe7] dark:bg-[#333333]' : ''
                ]"
                :title="chat.title"
                :aria-label="'Chat: ' + chat.title"
             >
                <Pin v-if="chat.isPinned" class="w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0 mr-3 fill-gray-500 dark:fill-gray-400 rotate-45" />
                <MessageSquare v-else class="w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0 mr-3" />
                                <!-- Edit Title Input -->
                 <form v-if="isOpen && editingChatId === chat.id" @submit.prevent="handleRename(chat.id)" class="flex-1 pr-2">
                     <input 
                         :id="`edit-input-${chat.id}`"
                         v-model="editingTitle"
                         @blur="handleRename(chat.id)"
                         @keydown.esc="cancelEdit"
                         type="text"
                         class="w-full text-sm bg-white dark:bg-[#1f1f1f] text-[#1f1f1f] dark:text-gray-300 px-2 py-1 rounded border border-blue-500 dark:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                     />
                 </form>
                 
                 <!-- Regular Title Display -->
                 <span v-else-if="isOpen" class="text-sm text-[#1f1f1f] dark:text-gray-300 truncate transition-opacity duration-200 flex-1 pr-6">{{ chat.title }}</span>
             </button>

             <!-- Three Dots Trigger -->
             <button 
                v-if="isOpen"
                @click="toggleDropdown(chat.id, $event)"
                class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-gray-300 dark:hover:bg-[#404040] text-gray-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                :class="{'bg-gray-300 dark:bg-[#404040]': activeDropdownId === chat.id}"
             >
                 <MoreHorizontal class="w-4 h-4" />
             </button>

             <!-- Dropdown Menu -->
             <div 
                v-if="activeDropdownId === chat.id"
                class="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-[#1f1f1f] rounded-lg shadow-lg border border-gray-200 dark:border-[#333333] z-50 overflow-hidden py-1"
             >
                 <button 
                    @click.stop="startEdit(chat)"
                    class="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#262626] transition-colors gap-2"
                 >
                     <Pencil class="w-4 h-4" />
                     Rename
                 </button>
                 <button 
                    @click.stop="handlePin(chat)"
                    class="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#262626] transition-colors gap-2"
                 >
                     <Pin class="w-4 h-4" :class="{'fill-gray-700 dark:fill-gray-300': chat.isPinned}"/> 
                     {{ chat.isPinned ? 'Unpin' : 'Pin' }}
                 </button>
                 <button 
                    @click.stop="handleDelete(chat.id)"
                    class="flex items-center w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors gap-2"
                 >
                     <Trash2 class="w-4 h-4" /> Delete
                 </button>
             </div>
         </div>
         
         <div v-if="chats.length === 0 && isOpen" class="px-4 py-3 text-sm text-gray-400 italic">
             No recent chats
         </div>
      </div>

       <!-- Market Charts Link -->
       <StockTicker v-show="isOpen" />
       <div v-show="isOpen" class="px-2 mt-2">
            <router-link
                to="/market-charts"
                class="flex items-center w-full p-3 hover:bg-[#dde3ea] dark:hover:bg-[#262626] rounded-full transition-colors text-left group"
                active-class="bg-[#d0dbe7] dark:bg-[#333333]"
            >
                 <div class="flex items-center justify-center w-4 h-4 mr-3 text-gray-500 dark:text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>
                </div>
                <span class="text-sm text-[#1f1f1f] dark:text-gray-300">Market Charts</span>
            </router-link>
            <router-link
                to="/news"
                class="flex items-center w-full p-3 hover:bg-[#dde3ea] dark:hover:bg-[#262626] rounded-full transition-colors text-left group mt-1"
                active-class="bg-[#d0dbe7] dark:bg-[#333333]"
            >
                 <div class="flex items-center justify-center w-4 h-4 mr-3 text-gray-500 dark:text-gray-400">
                    <Newspaper class="w-4 h-4" />
                </div>
                <span class="text-sm text-[#1f1f1f] dark:text-gray-300">News</span>
            </router-link>
       </div>

      <!-- Bottom Section: Settings & User -->
      <div class="p-2 mt-auto border-t border-gray-200 dark:border-[#262626] pb-safe">
        <!-- Info Trigger and Popover -->
        <div class="relative">
            <button 
                @click="toggleInfo"
                class="flex items-center gap-3 w-full p-3 hover:bg-[#dde3ea] dark:hover:bg-[#262626] rounded-full transition-colors text-left min-w-[44px]"
                :class="{'justify-center': !isOpen, 'bg-[#dde3ea] dark:bg-[#262626]': isInfoOpen}"
                title="Info"
                aria-label="Information"
            >
              <Info class="w-5 h-5 text-gray-500 dark:text-gray-400 shrink-0" />
              <span v-if="isOpen" class="text-sm text-[#1f1f1f] dark:text-gray-300 transition-opacity duration-200">Info</span>
            </button>

            <!-- Info Popover -->
            <div 
                v-if="isInfoOpen"
                @click.stop
                :class="[
                    'fixed bottom-0 mb-0 w-full rounded-t-2xl rounded-b-none p-2 z-[60]',
                    'md:w-60 md:rounded-xl md:bottom-2',
                    'bg-[#f0f4f9] dark:bg-[#171717]',
                    'shadow-[0_-4px_20px_rgba(0,0,0,0.1)] md:shadow-xl',
                    'border-t border-gray-200 dark:border-[#333333] md:border',
                    'animate-in slide-in-from-bottom-full md:slide-in-from-left-2 duration-300 md:duration-200',
                    'left-0 right-0 md:right-auto',
                    isOpen ? 'md:left-[17rem]' : 'md:left-[5rem]'
                ]"
            >
                <!-- Mobile Drag Handle (Visual Only) -->
                <div class="md:hidden w-full flex justify-center py-2 mb-1">
                     <div class="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                </div>

                <div class="flex items-center justify-between p-2 mb-1 border-b border-gray-200 dark:border-[#333333]">
                    <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Info</span>
                    <button @click="isInfoOpen = false" class="p-1 hover:bg-gray-200 dark:hover:bg-[#333333] rounded-md text-gray-500 transition-colors">
                        <X class="w-3 h-3" />
                    </button>
                </div>
                
                <!-- Plan Status (Moved here) -->
                <div v-if="user && currentPlan" class="px-3 py-3 mb-2 bg-white dark:bg-[#262626] rounded-xl border border-gray-100 dark:border-[#333]">
                     <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Current Plan</span>
                        <span class="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full capitalize">
                            {{ currentPlan.type }}
                        </span>
                     </div>
                     
                     <div class="space-y-1">
                        <div class="flex justify-between text-xs text-gray-600 dark:text-gray-300">
                             <span>Kurasi Think</span>
                             <span v-if="isKurasiUnlimited" class="text-green-600 dark:text-green-400 font-medium">Unlimited</span>
                             <span v-else>{{ usageCount }}/{{ MAX_DAILY_USAGE }} Used</span>
                        </div>
                        
                        <div v-if="!isKurasiUnlimited" class="w-full h-1.5 bg-gray-100 dark:bg-[#333] rounded-full overflow-hidden">
                             <div class="h-full bg-blue-500 rounded-full transition-all duration-300" 
                                  :style="{ width: `${Math.min((usageCount / MAX_DAILY_USAGE) * 100, 100)}%` }"
                             ></div>
                        </div>
                        <div v-if="!isKurasiUnlimited" class="text-[10px] text-gray-400 text-right pt-0.5">
                             Resets at 04:00 AM
                        </div>
                     </div>
                </div>
                
                <router-link 
                    to="/policy"
                    class="flex items-center justify-between w-full p-2.5 hover:bg-white dark:hover:bg-[#262626] rounded-lg transition-colors group mb-2"
                >
                    <div class="flex items-center gap-3">
                         <span class="text-sm font-medium text-gray-700 dark:text-gray-200">Policy</span>
                    </div>
                </router-link>

                <div class="px-2 py-3 text-center border-t border-gray-200 dark:border-[#333333]">
                     <span class="text-[10px] text-gray-400 dark:text-gray-500 font-medium tracking-wide">Copyright 2026 DeepKura</span>
                </div>
            </div>
        </div>
        
        <!-- Settings Trigger and Popover -->
        <div class="relative">
            <button 
                @click="toggleSettings"
                class="flex items-center gap-3 w-full p-3 hover:bg-[#dde3ea] dark:hover:bg-[#262626] rounded-full transition-colors text-left min-w-[44px]" 
                :class="{'justify-center': !isOpen, 'bg-[#dde3ea] dark:bg-[#262626]': isSettingsOpen}" 
                title="Settings"
                aria-label="Settings"
            >
            <Settings class="w-5 h-5 text-gray-500 dark:text-gray-400 shrink-0" />
            <span v-if="isOpen" class="text-sm text-[#1f1f1f] dark:text-gray-300 transition-opacity duration-200">Settings</span>
            </button>

            <!-- Settings Popover -->
            <div 
                v-if="isSettingsOpen"
                @click.stop
                :class="[
                    'fixed bottom-0 mb-0 w-full rounded-t-2xl rounded-b-none p-2 z-[60]',
                    'md:w-60 md:rounded-xl md:bottom-2',
                    'bg-[#f0f4f9] dark:bg-[#171717]',
                    'shadow-[0_-4px_20px_rgba(0,0,0,0.1)] md:shadow-xl',
                    'border-t border-gray-200 dark:border-[#333333] md:border',
                    'animate-in slide-in-from-bottom-full md:slide-in-from-left-2 duration-300 md:duration-200',
                    'left-0 right-0 md:right-auto',
                    isOpen ? 'md:left-[17rem]' : 'md:left-[5rem]'
                ]"
            >
                <!-- Mobile Drag Handle (Visual Only) -->
                <div class="md:hidden w-full flex justify-center py-2 mb-1">
                     <div class="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                </div>
                 <div class="flex items-center justify-between p-2 mb-1 border-b border-gray-200 dark:border-[#333333]">
                    <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Settings</span>
                    <button @click="isSettingsOpen = false" class="p-1 hover:bg-gray-200 dark:hover:bg-[#333333] rounded-md text-gray-500 transition-colors">
                        <X class="w-3 h-3" />
                    </button>
                </div>
                

                
                <button 
                    @click="toggleDarkMode()"
                    class="flex items-center justify-between w-full p-2.5 hover:bg-white dark:hover:bg-[#262626] rounded-lg transition-colors group"
                >
                    <div class="flex items-center gap-3">
                        <div class="p-1.5 bg-gray-200 dark:bg-gray-800 rounded-md text-gray-700 dark:text-gray-200 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            <Moon v-if="isDarkMode" class="w-4 h-4" />
                            <Sun v-else class="w-4 h-4" />
                        </div>
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-200">Dark Mode</span>
                    </div>
                    
                    <div class="text-gray-400 dark:text-gray-500">
                         <span v-if="isDarkMode" class="text-xs">On</span>
                         <span v-else class="text-xs">Off</span>
                    </div>
                </button>
            </div>
        </div>

        <!-- Login Button (when not logged in) -->
        <button 
            v-if="!user"
            @click="handleLogin"
            class="flex items-center gap-3 w-full p-3 hover:bg-[#dde3ea] dark:hover:bg-[#262626] rounded-full transition-colors text-left min-w-[44px]" 
            :class="{'justify-center': !isOpen}" 
            title="Login / Sign Up"
            aria-label="Login"
        >
          <LogIn class="w-5 h-5 text-gray-500 dark:text-gray-400 shrink-0" />
          <span v-if="isOpen" class="text-sm text-[#1f1f1f] dark:text-gray-300 transition-opacity duration-200">Login / Sign Up</span>
        </button>
        
        <!-- Logout Button (when logged in) -->
        <button 
            v-else
            @click="handleLogout"
            class="flex items-center gap-3 w-full p-3 hover:bg-[#dde3ea] dark:hover:bg-[#262626] rounded-full transition-colors text-left min-w-[44px]" 
            :class="{'justify-center': !isOpen}" 
            title="Logout"
            aria-label="Logout"
        >
          <LogOut class="w-5 h-5 text-gray-500 dark:text-gray-400 shrink-0" />
          <span v-if="isOpen" class="text-sm text-[#1f1f1f] dark:text-gray-300 transition-opacity duration-200">Logout</span>
        </button>
        
         <div v-if="!isOpen" class="mt-2 hidden md:flex justify-center">
              <span class="text-[10px] text-gray-400">v2</span>
         </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1; 
  border-radius: 2px;
}
</style>
