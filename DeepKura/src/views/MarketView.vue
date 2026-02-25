<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ChevronDown, Check, Menu } from 'lucide-vue-next';
import Sidebar from '../components/Sidebar.vue';
import MarketGrid from '../components/MarketGrid.vue';

const isSidebarOpen = ref(true);
const searchQuery = ref('');
const filterType = ref('all');
const isFilterDropdownOpen = ref(false);

const toggleFilterDropdown = (e: Event) => {
    e.stopPropagation();
    isFilterDropdownOpen.value = !isFilterDropdownOpen.value;
};

const closeFilterDropdown = () => {
    isFilterDropdownOpen.value = false;
};

const selectFilter = (type: string) => {
    filterType.value = type;
    isFilterDropdownOpen.value = false;
};

onMounted(() => {
  if (window.innerWidth < 768) {
    isSidebarOpen.value = false;
  }
});

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

const reloadPage = () => {
  window.location.reload();
};

const clearSearch = () => {
  searchQuery.value = '';
};
</script>

<template>
  <div class="flex h-[100dvh] bg-white dark:bg-[#0a0a0a] overflow-hidden transition-colors duration-300">
    <Sidebar 
      :is-open="isSidebarOpen" 
      @toggle="toggleSidebar"
    />
    
    <div 
      class="flex-1 flex flex-col min-w-0 relative z-0 h-full"
      :class="{'opacity-25 pointer-events-none md:opacity-100 md:pointer-events-auto': isSidebarOpen}"
    >
        <!-- Header -->
        <!-- Mobile Toggle (Absolute) -->
       <!-- Fixed Search Header -->
       <div class="flex-none z-30 bg-gray-50 dark:bg-[#0a0a0a] px-4 py-4 md:py-6 md:px-6 border-b border-transparent">
           <div class="max-w-7xl mx-auto relative">
                <!-- Branding Row (Mobile) / Absolute Left (Desktop) -->
                <div class="flex items-center gap-3 pb-4 md:pb-0 md:absolute md:left-0 md:top-1/2 md:-translate-y-1/2 z-10">
                    <!-- Hamburger (Mobile Only) -->
                    <button 
                        v-if="!isSidebarOpen"
                        @click="toggleSidebar" 
                        class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400 transition-colors md:hidden"
                    >
                        <Menu class="w-5 h-5" />
                    </button>
                    
                    <!-- Branding (Mobile & Desktop) -->
                     <div @click="reloadPage" class="flex items-center gap-2 md:gap-3 cursor-pointer select-none group">
                        <div class="relative w-7 h-7 md:w-9 md:h-9 flex items-center justify-center">
                            <img src="/logo.svg" alt="DeepKura Logo" class="w-full h-full object-contain drop-shadow-sm transition-transform group-hover:scale-110 duration-300" />
                        </div>
                        <h1 class="text-lg md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight leading-none !m-0 group-hover:opacity-80 transition-opacity">
                            DeepKura
                        </h1>
                        <span class="text-[10px] text-gray-400 dark:text-gray-500 font-medium ml-1 mt-1">Powered By Yfinance</span>
                    </div>
                </div>

               <div class="flex items-center gap-2 md:justify-center w-full relative">
                   <div class="flex-1 md:w-96 md:flex-none">
                       <div class="relative">
                           <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                               <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                               </svg>
                           </div>
                           <input
                               v-model="searchQuery"
                               type="text"
                               placeholder="Search by ticker..."
                               class="block w-full pl-10 pr-10 py-2.5 text-sm border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#121212] text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                           />
                           <button
                               v-if="searchQuery"
                               @click="clearSearch"
                               class="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                           >
                               <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                               </svg>
                           </button>
                       </div>
                   </div>

                   <!-- Filter Dropdown -->
                   <div class="flex-none md:absolute md:right-0 md:top-0" v-if="!searchQuery || true"> <!-- Keep visible -->
                        <div class="relative inline-block text-left">
                            <button 
                                @click="toggleFilterDropdown"
                                type="button" 
                                class="inline-flex justify-between items-center w-24 md:w-32 px-3 py-2.5 md:px-4 md:py-2 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-[#121212] border border-gray-300 dark:border-[#262626] rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-[#1f1f1f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <span v-if="filterType === 'all'">All</span>
                                <span v-else-if="filterType === 'gainers'">Green</span>
                                <span v-else>Red</span>
                                <ChevronDown class="w-4 h-4 ml-2" />
                            </button>

                            <!-- Dropdown Menu -->
                            <div 
                                v-if="isFilterDropdownOpen"
                                class="absolute mt-2 w-48 rounded-xl shadow-lg bg-white dark:bg-[#1f1f1f] ring-1 ring-black ring-opacity-5 focus:outline-none z-50 overflow-hidden origin-top-right right-0"
                            >
                                <div class="py-1">
                                    <button 
                                        @click="selectFilter('all')"
                                        class="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#262626]"
                                    >
                                        <Check v-if="filterType === 'all'" class="w-4 h-4 mr-2 text-blue-500" />
                                        <span v-else class="w-4 h-4 mr-2"></span>
                                        All
                                    </button>
                                    <button 
                                        @click="selectFilter('gainers')"
                                        class="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#262626]"
                                    >
                                        <Check v-if="filterType === 'gainers'" class="w-4 h-4 mr-2 text-green-500" />
                                        <span v-else class="w-4 h-4 mr-2"></span>
                                        Green
                                    </button>
                                    <button 
                                        @click="selectFilter('losers')"
                                        class="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#262626]"
                                    >
                                        <Check v-if="filterType === 'losers'" class="w-4 h-4 mr-2 text-red-500" />
                                        <span v-else class="w-4 h-4 mr-2"></span>
                                        Red
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Backdrop to close -->
                            <div v-if="isFilterDropdownOpen" @click="closeFilterDropdown" class="fixed inset-0 z-40 bg-transparent"></div>
                        </div>
                   </div>
               </div>
           </div>
       </div>

       <main class="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#0a0a0a]">
           <!-- Market Grid -->
           <div class="p-4 md:p-6">
               <MarketGrid :search-query="searchQuery" :filter-type="filterType" />
           </div>
       </main>
    </div>
  </div>
</template>
