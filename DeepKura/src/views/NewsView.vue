<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import Sidebar from '../components/Sidebar.vue';
import { Menu, Newspaper, ExternalLink, RefreshCw, Loader2, ChevronDown, Check } from 'lucide-vue-next';

interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  date: string;
  ticker?: string;
  change_pct?: number; // Added to store price change for filtering
}

const isSidebarOpen = ref(true);
const isLoading = ref(false);
const news = ref<NewsItem[]>([]);
const lastUpdated = ref<string | null>(null);
const filterType = ref('all');
const searchQuery = ref('');
const isFilterDropdownOpen = ref(false);

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (e) {
    return dateString;
  }
};

const getFaviconUrl = (url: string) => {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
        return '';
    }
};

const handleImageError = (event: Event) => {
    const target = event.target as HTMLImageElement;
    if (target) {
        target.style.display = 'none';
        const parent = target.parentElement;
        if (parent) {
            const fallback = parent.querySelector('.fallback-icon');
            if (fallback) (fallback as HTMLElement).style.display = 'flex';
        }
    }
};

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

const reloadPage = () => {
  window.location.reload();
};

const clearSearch = () => {
  searchQuery.value = '';
};

const fetchNews = async () => {
  isLoading.value = true;
  news.value = [];
  try {
    const stocksResponse = await fetch('/stocks.txt');
    if (!stocksResponse.ok) throw new Error('Failed to load stocks list');
    const stocksText = await stocksResponse.text();
    const tickers = stocksText.split('\n').map(t => t.trim()).filter(t => t);

    // Fetch news and stock data in parallel to get change_pct
    const promises = tickers.map(async (ticker) => {
        try {
            // Fetch News FIRST
            const newsRes = await fetch(`/api/news/${ticker}`);
            const newsData = newsRes.ok ? await newsRes.json() : { news: [] };
            
            // Optimization: Only fetch stock data if there IS news for this ticker
            if (newsData.news && Array.isArray(newsData.news) && newsData.news.length > 0) {
                let change_pct = 0;
                try {
                    const stockRes = await fetch(`/api/chart/intraday/${ticker}`);
                    if (stockRes.ok) {
                        const stockData = await stockRes.json();
                        if (stockData.data && stockData.data.length > 0) {
                            change_pct = stockData.data[stockData.data.length - 1].change_pct;
                        }
                    }
                } catch (e) { /* ignore stock fetch error */ }

                return newsData.news.map((item: any) => ({ ...item, ticker, change_pct }));
            }
            return [];
        } catch (err) {
            return [];
        }
    });

    const results = await Promise.allSettled(promises);
    const allNews: NewsItem[] = [];
    
    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
            allNews.push(...result.value);
        }
    });

    // Deduplicate
    const uniqueNews = Array.from(new Map(allNews.map(item => [item.link, item])).values());
    // Sort by date
    uniqueNews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    news.value = uniqueNews;
    lastUpdated.value = new Date().toLocaleTimeString();

  } catch (err) {
      console.error("Error fetching news:", err);
  } finally {
      isLoading.value = false;
  }
};

const filteredNews = computed(() => {
    let result = news.value;

    // 1. Text Search Filter
    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        result = result.filter(item => 
            (item.ticker && item.ticker.toLowerCase().includes(query)) || 
            item.title.toLowerCase().includes(query) ||
            item.publisher.toLowerCase().includes(query)
        );
    }

    // 2. Type Filter
    if (filterType.value === 'positive') {
        result = result.filter(item => (item.change_pct || 0) >= 0);
    } else if (filterType.value === 'negative') {
        result = result.filter(item => (item.change_pct || 0) < 0);
    }
    
    return result;
});

onMounted(() => {
  if (window.innerWidth < 768) {
    isSidebarOpen.value = false;
  }
  fetchNews();
});
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
        <!-- Header (Matched to MarketView) -->
        <div class="flex-none z-30 bg-gray-50 dark:bg-[#0a0a0a] px-4 py-4 md:py-6 md:px-6 border-b border-transparent">
           <div class="max-w-7xl mx-auto relative">
                <!-- Branding Row (Mobile) / Absolute Left (Desktop) -->
                <div class="flex items-center gap-3 pb-4 md:pb-0 md:absolute md:left-0 md:top-1/2 md:-translate-y-1/2 z-10">
                    <button 
                        v-if="!isSidebarOpen"
                        @click="toggleSidebar" 
                        class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400 transition-colors md:hidden"
                    >
                        <Menu class="w-5 h-5" />
                    </button>
                    
                    <div @click="reloadPage" class="flex items-center gap-2 md:gap-3 cursor-pointer select-none group">
                        <div class="relative w-7 h-7 md:w-9 md:h-9 flex items-center justify-center">
                            <img src="/logo.svg" alt="DeepKura Logo" class="w-full h-full object-contain drop-shadow-sm transition-transform group-hover:scale-110 duration-300" />
                        </div>
                        <h1 class="text-lg md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight leading-none !m-0 group-hover:opacity-80 transition-opacity">
                            DeepKura
                        </h1>
                        <span class="text-[10px] text-gray-400 dark:text-gray-500 font-medium ml-1 mt-1">News</span>
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
                               placeholder="Search ticker or news..."
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
                   <div class="flex-none md:absolute md:right-0 md:top-0 z-20">
                        <div class="relative inline-block text-left">
                            <button 
                                @click="toggleFilterDropdown"
                                type="button" 
                                class="inline-flex justify-between items-center w-32 px-3 py-2.5 md:px-4 md:py-2 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-[#121212] border border-gray-300 dark:border-[#262626] rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-[#1f1f1f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <span v-if="filterType === 'all'">All</span>
                                <span v-else-if="filterType === 'positive'">Positive</span>
                                <span v-else>Negative</span>
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
                                        @click="selectFilter('positive')"
                                        class="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#262626]"
                                    >
                                        <Check v-if="filterType === 'positive'" class="w-4 h-4 mr-2 text-green-500" />
                                        <span v-else class="w-4 h-4 mr-2"></span>
                                        Positive
                                    </button>
                                    <button 
                                        @click="selectFilter('negative')"
                                        class="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#262626]"
                                    >
                                        <Check v-if="filterType === 'negative'" class="w-4 h-4 mr-2 text-red-500" />
                                        <span v-else class="w-4 h-4 mr-2"></span>
                                        Negative
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

        <!-- Content -->
        <main class="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-gray-50 dark:bg-[#0a0a0a]">
            <div class="max-w-7xl mx-auto"> <!-- Increased max-width for grid -->
                
                <!-- Skeleton Loader -->
                <div v-if="isLoading && news.length === 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     <div v-for="i in 9" :key="i" class="bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-xl p-4 shadow-sm animate-pulse flex flex-col gap-3 h-48">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-gray-200 dark:bg-[#262626]"></div>
                            <div class="flex-1">
                                <div class="h-3 bg-gray-200 dark:bg-[#262626] rounded w-1/3 mb-1.5"></div>
                                <div class="h-2 bg-gray-100 dark:bg-[#333] rounded w-1/4"></div>
                            </div>
                        </div>
                        <div class="flex-1 space-y-2 mt-1">
                            <div class="h-4 bg-gray-200 dark:bg-[#262626] rounded w-full"></div>
                            <div class="h-4 bg-gray-200 dark:bg-[#262626] rounded w-5/6"></div>
                        </div>
                        <div class="mt-auto pt-2 flex justify-between items-center">
                             <div class="h-3 bg-gray-200 dark:bg-[#262626] rounded w-20"></div>
                             <div class="h-8 bg-gray-200 dark:bg-[#262626] rounded w-24"></div>
                        </div>
                     </div>
                </div>

                <div v-else-if="!isLoading && filteredNews.length === 0" class="text-center py-20 text-gray-500">
                    <p class="mb-2">No news found.</p>
                    <p class="text-xs text-gray-400">Try adjusting the filter or checking backend.</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <article 
                        v-for="(item, index) in filteredNews" 
                        :key="item.link"
                        class="bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-xl p-4 hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group shadow-sm flex flex-col h-full"
                    >
                        <!-- Header: Icon & Meta -->
                         <div class="flex items-start gap-3 mb-3">
                            <div class="flex-none relative w-10 h-10">
                                <img 
                                    :src="getFaviconUrl(item.link)" 
                                    alt="" 
                                    class="w-full h-full rounded-lg bg-gray-50 dark:bg-[#262626] object-contain border border-gray-100 dark:border-[#333] transition-transform duration-300 group-hover:scale-110"
                                    @error="handleImageError"
                                />
                                 <div class="fallback-icon absolute inset-0 hidden items-center justify-center bg-gray-100 dark:bg-[#262626] rounded-lg border border-gray-200 dark:border-[#333]">
                                    <Newspaper class="w-5 h-5 text-gray-400" />
                                </div>
                            </div>
                            <div class="flex-1 min-w-0 flex flex-col justify-center">
                                <div class="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">
                                    {{ item.publisher }}
                                </div>
                                <div class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                                    {{ formatDate(item.date) }}
                                </div>
                            </div>
                        </div>

                        <!-- Title -->
                        <a :href="item.link" target="_blank" rel="noopener noreferrer" class="block flex-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-3">
                            <h2 class="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug font-display line-clamp-3">
                                {{ item.title }}
                            </h2>
                        </a>

                        <!-- Footer: Link -->
                        <div class="mt-auto pt-3 border-t border-gray-100 dark:border-[#262626] flex items-center justify-between">
                             <a :href="item.link" target="_blank" rel="noopener noreferrer" class="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                                Read <ExternalLink class="w-3 h-3" />
                            </a>
                        </div>
                    </article>
                </div>
            </div>
        </main>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 20px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(75, 85, 99, 0.5);
}

.font-display {
    /* If you have a display font, use it here, otherwise inherit */
}
</style>
