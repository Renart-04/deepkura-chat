<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'vue-chartjs';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend, 
  Filler
);

interface StockDataPoint {
    timestamp: string;
    price: number;
    volume: number;
    change_pct: number;
}

interface StockResponse {
    ticker: string;
    trading_date: string;
    data: StockDataPoint[];
}

interface StockState {
    ticker: string;
    loading: boolean;
    error: string | null;
    currentPrice: number | null;
    priceChange: number | null;
    isVisible: boolean;
    chartData: {
        labels: string[];
        datasets: any[];
    };
}

const props = defineProps<{
    searchQuery?: string;
    filterType?: string;
}>();

const TICKERS = ref<string[]>([]);
const stockStates = ref<Record<string, StockState>>({});
const itemRefs = ref<Record<string, HTMLElement | null>>({});

// Computed property to filter tickers based on search query and filter type
const filteredTickers = computed(() => {
    let result = TICKERS.value;

    // 1. Filter by Search Query
    if (props.searchQuery && props.searchQuery.trim() !== '') {
        const query = props.searchQuery.toLowerCase().trim();
        result = result.filter(ticker => 
            ticker.toLowerCase().includes(query)
        );
    }

    // 2. Filter by Type (Gainers/Losers)
    if (props.filterType && props.filterType !== 'all') {
        result = result.filter(ticker => {
            const state = stockStates.value[ticker];
            if (!state || state.loading || state.priceChange === null) return false; // Hide completely if loading or no data when filtering
            
            if (props.filterType === 'gainers') {
                return state.priceChange >= 0;
            } else if (props.filterType === 'losers') {
                return state.priceChange < 0;
            }
            return true;
        });
    }

    return result;
});

const initStockState = (ticker: string) => {
    stockStates.value[ticker] = {
        ticker,
        loading: true,
        error: null,
        currentPrice: null,
        priceChange: null,
        isVisible: false,
        chartData: {
            labels: [],
            datasets: [
                {
                    label: 'Price',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderColor: '#3b82f6',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    borderWidth: 2,
                    data: []
                }
            ]
        }
    };
};

const commonChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false as const,
  resizeDelay: 200,
  interaction: {
      intersect: false,
      mode: 'index' as const
  },
  plugins: {
    legend: { display: false },
    tooltip: { 
        enabled: true,
        callbacks: {
            label: function(context: any) {
                let label = context.dataset.label || '';
                if (label) {
                    label += ': ';
                }
                if (context.parsed.y !== null) {
                    label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                }
                return label;
            }
        }
    }
  },
  scales: {
      x: { 
          display: true,
          grid: {
              display: false,
              drawBorder: false
          },
          ticks: {
              maxTicksLimit: 6,
              maxRotation: 0,
              color: '#9ca3af',
              font: {
                  size: 10
              }
          }
      },
      y: { 
          display: true,
          grid: {
              color: 'rgba(0, 0, 0, 0.05)',
              drawBorder: false
          },
          ticks: {
              color: '#9ca3af',
              font: {
                  size: 10
              },
              callback: function(value: any) {
                  return '$' + value.toFixed(2);
              }
          }
      }
  },
  elements: {
      point: { radius: 0, hitRadius: 10 }
  }
};

const fetchStockData = async (ticker: string) => {
    const state = stockStates.value[ticker];
    if (!state) return;

    if (state.chartData.labels.length === 0) {
        state.loading = true;
    }
    
    try {
        const response = await fetch(`/api/chart/intraday/${ticker}`);
        if (!response.ok) throw new Error('Fetch failed');
        
        const result: StockResponse = await response.json();
        
        // Format timestamps for X-axis
        const labels = result.data.map(d => {
            const date = new Date(d.timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        });
        const prices = result.data.map(d => d.price);

        if (labels.length > 0 && prices.length > 0) {
            const latestData = result.data[result.data.length - 1];
            const isAhPositive = latestData ? latestData.change_pct >= 0 : false;
            
            state.chartData = {
                labels,
                datasets: [{
                    ...state.chartData.datasets[0],
                    data: prices,
                    borderColor: isAhPositive ? '#10b981' : '#ef4444',
                    backgroundColor: isAhPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    pointBackgroundColor: isAhPositive ? '#10b981' : '#ef4444',
                }]
            };
        }

        if (result.data.length > 0) {
            const latest = result.data[result.data.length - 1];
            if (latest) {
                state.currentPrice = latest.price;
                state.priceChange = latest.change_pct;
            }
        } else {
             state.currentPrice = null;
             state.priceChange = null;
        }

        state.loading = false;
        state.error = null;

    } catch (e: any) {
        state.error = e.message;
        state.loading = false;
    }
};

let observer: IntersectionObserver | null = null;

const setupObserver = () => {
    if (observer) observer.disconnect();

    observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const ticker = (entry.target as HTMLElement).dataset.ticker;
                if (ticker && stockStates.value[ticker]) {
                    stockStates.value[ticker].isVisible = true;
                    // Optional: could trigger fetchStockData here if we wanted to be super lazy
                }
            }
        });
    }, {
        rootMargin: '100px', // Preload when 100px away
        threshold: 0.1
    });

    // Observe all current refs
    Object.values(itemRefs.value).forEach(el => {
        if (el) observer?.observe(el);
    });
};

const fetchTickers = async () => {
    try {
        const response = await fetch('/stocks.txt');
        if (!response.ok) throw new Error('Failed to load stock list');
        const text = await response.text();
        const parsedTickers = text
            .split('\n')
            .map(t => t.trim())
            .filter(t => t.length > 0 && !t.startsWith('#'));
            // Remove slice to show all stocks in grid
        
        TICKERS.value = [...new Set(parsedTickers)];
        
        TICKERS.value.forEach(ticker => {
            if (!stockStates.value[ticker]) initStockState(ticker);
        });

        fetchAllData();
        
        // Wait for DOM update then observe
        nextTick(() => {
            setupObserver();
        });

    } catch (e) {
        console.error('Error loading stocks.txt:', e);
        TICKERS.value = ['AAPL', 'NVDA', 'MSFT', 'TSLA'];
        TICKERS.value.forEach(ticker => {
             if (!stockStates.value[ticker]) initStockState(ticker);
        });
        fetchAllData();
        // Wait for DOM update then observe
        nextTick(() => {
            setupObserver();
        });
    }
};

const fetchAllData = () => {
    TICKERS.value.forEach(ticker => fetchStockData(ticker));
};

let intervalId: number | null = null;

onMounted(() => {
    fetchTickers();
    intervalId = setInterval(fetchAllData, 60000);
});

onUnmounted(() => {
    if (intervalId) clearInterval(intervalId);
    if (observer) observer.disconnect();
});
</script>

<template>
  <div>
    <!-- No Results Message -->
    <div v-if="filteredTickers.length === 0" class="flex flex-col items-center justify-center py-16">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No charts found</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400">Try searching with a different ticker symbol</p>
    </div>

    <!-- Market Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-6">
      <div v-for="ticker in filteredTickers" :key="ticker" 
           :ref="(el) => { if (el) itemRefs[ticker] = el as HTMLElement }"
           :data-ticker="ticker"
           class="bg-white dark:bg-[#121212] rounded-2xl border border-gray-200 dark:border-[#262626] p-5 flex flex-col h-80 shadow-sm transition-opacity duration-500"
           :class="{'opacity-0': !stockStates[ticker]?.isVisible, 'opacity-100': stockStates[ticker]?.isVisible}"
           >
          
          <div class="flex justify-between items-start mb-4">
              <div>
                  <h3 class="text-lg font-bold text-gray-900 dark:text-white">{{ ticker }}</h3>
                  <div v-if="stockStates[ticker] && stockStates[ticker].currentPrice" class="flex items-baseline gap-2 mt-1">
                        <span class="text-2xl font-bold text-gray-900 dark:text-white">
                            ${{ stockStates[ticker].currentPrice?.toFixed(2) }}
                        </span>
                        <span :class="['text-sm font-medium px-2 py-0.5 rounded-full', (stockStates[ticker].priceChange ?? 0) >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400']">
                            {{ (stockStates[ticker].priceChange ?? 0) >= 0 ? '+' : '' }}{{ stockStates[ticker].priceChange?.toFixed(2) }}%
                        </span>
                  </div>
              </div>
              
              <div v-if="stockStates[ticker] && stockStates[ticker].loading" class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          </div>

          <!-- Chart Container -->
          <div class="flex-1 w-full min-h-0 relative">
               <div v-if="stockStates[ticker]?.isVisible && stockStates[ticker] && !stockStates[ticker].loading && !stockStates[ticker].error" class="h-full w-full">
                    <Line :data="stockStates[ticker].chartData" :options="commonChartOptions" />
               </div>
               
               <div v-if="stockStates[ticker] && stockStates[ticker].error" class="absolute inset-0 flex items-center justify-center text-sm text-red-500">
                  {{ stockStates[ticker].error }}
               </div>
           </div>
       </div>
    </div>
  </div>
</template>
