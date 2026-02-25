<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
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
    chartData: {
        labels: string[];
        datasets: any[];
    };
}

const TICKERS = ref<string[]>([]);
const stockStates = ref<Record<string, StockState>>({});

const initStockState = (ticker: string) => {
    stockStates.value[ticker] = {
        ticker,
        loading: true,
        error: null,
        currentPrice: null,
        priceChange: null,
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
                    pointHoverRadius: 0,
                    borderWidth: 1.5,
                    data: []
                }
            ]
        }
    };
};

const commonChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
      intersect: false,
      mode: 'index' as const
  },
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false } // Disable tooltips for cleaner mini-charts
  },
  scales: {
      x: { display: false }, // Hide X axis
      y: { display: false }  // Hide Y axis
  },
  elements: {
      point: { radius: 0 }
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
        
        const labels = result.data.map(d => d.timestamp);
        const prices = result.data.map(d => d.price);

        if (labels.length > 0 && prices.length > 0) {
            const latestData = result.data[result.data.length - 1];
            // default to red if undefined, though length check makes it safe
            const isAhPositive = latestData ? latestData.change_pct >= 0 : false; 
            
            state.chartData = {
                labels,
                datasets: [{
                    ...state.chartData.datasets[0],
                    data: prices,
                    borderColor: isAhPositive ? '#10b981' : '#ef4444',
                    backgroundColor: isAhPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
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

const fetchTickers = async () => {
    try {
        const response = await fetch('/stocks.txt');
        if (!response.ok) throw new Error('Failed to load stock list');
        const text = await response.text();
        const parsedTickers = text
            .split('\n')
            .map(t => t.trim())
            .filter(t => t.length > 0 && !t.startsWith('#'))
            .slice(0, 4); // Limit to top 4 for the row
        
        TICKERS.value = [...new Set(parsedTickers)];
        
        TICKERS.value.forEach(ticker => {
            if (!stockStates.value[ticker]) initStockState(ticker);
        });

        fetchAllData();

    } catch (e) {
        console.error('Error loading stocks.txt:', e);
        TICKERS.value = ['AAPL', 'NVDA', 'MSFT', 'TSLA'];
        TICKERS.value.forEach(ticker => {
             if (!stockStates.value[ticker]) initStockState(ticker);
        });
        fetchAllData();
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
});
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-b border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a]">
      <div v-for="ticker in TICKERS" :key="ticker" 
           class="bg-white dark:bg-[#121212] rounded-xl border border-gray-200 dark:border-[#262626] p-3 flex flex-col justify-between h-24 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          
          <div class="flex justify-between items-start z-10">
              <div>
                  <h3 class="text-xs font-bold text-gray-500 dark:text-gray-400">{{ ticker }}</h3>
                  <div v-if="stockStates[ticker] && stockStates[ticker].currentPrice" class="mt-0.5">
                        <span class="text-sm font-bold text-gray-900 dark:text-white block">
                            ${{ stockStates[ticker].currentPrice?.toFixed(2) }}
                        </span>
                        <span :class="['text-[10px] font-medium block', (stockStates[ticker].priceChange ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400']">
                            {{ (stockStates[ticker].priceChange ?? 0) >= 0 ? '+' : '' }}{{ stockStates[ticker].priceChange?.toFixed(2) }}%
                        </span>
                  </div>
              </div>
              
              <div v-if="stockStates[ticker] && stockStates[ticker].loading" class="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
          </div>

          <!-- Mini Chart Background -->
          <div v-if="stockStates[ticker] && !stockStates[ticker].loading && !stockStates[ticker].error" class="absolute inset-0 top-6 left-0 right-0 bottom-0 opacity-80">
                <Line :data="stockStates[ticker].chartData" :options="commonChartOptions" />
          </div>
          
          <div v-if="stockStates[ticker] && stockStates[ticker].error" class="text-[10px] text-red-500 z-10 mt-auto">
              Error
          </div>
      </div>
  </div>
</template>
