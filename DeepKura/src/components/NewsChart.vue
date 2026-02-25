<script setup lang="ts">
import { ref, onMounted } from 'vue';
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

const props = defineProps<{
    ticker: string;
}>();

const loading = ref(true);
const error = ref<string | null>(null);
const currentPrice = ref<number | null>(null);
const priceChange = ref<number | null>(null);
const chartData = ref({
    labels: [] as string[],
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
            data: [] as number[]
        }
    ]
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
      intersect: false,
      mode: 'index' as const
  },
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false }
  },
  scales: {
      x: { display: false },
      y: { display: false }
  },
  elements: {
      point: { radius: 0 }
  }
};

const fetchChartData = async () => {
    loading.value = true;
    try {
        const response = await fetch(`/api/chart/intraday/${props.ticker}`);
        if (!response.ok) throw new Error('Fetch failed');
        
        const result: StockResponse = await response.json();
        
        const labels = result.data.map(d => d.timestamp);
        const prices = result.data.map(d => d.price);

        if (labels.length > 0 && prices.length > 0) {
            const latestData = result.data[result.data.length - 1];
            if (!latestData) return;

            const isPositive = latestData.change_pct >= 0;
            
            chartData.value = {
                labels,
                datasets: [{
                    label: 'Price',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    borderWidth: 1.5,
                    data: prices,
                    borderColor: isPositive ? '#10b981' : '#ef4444',
                    backgroundColor: isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                }]
            };
            
            currentPrice.value = latestData.price;
            priceChange.value = latestData.change_pct;
        }
    } catch (e: any) {
        error.value = e.message;
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    if (props.ticker) {
        fetchChartData();
    }
});
</script>

<template>
    <div class="flex flex-col h-full min-w-[140px] max-w-[140px] sm:border-l sm:border-gray-200 sm:dark:border-[#262626] sm:pl-4">
        <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-gray-500 dark:text-gray-400">{{ ticker }}</span>
            <div v-if="currentPrice" class="text-right">
                <div class="text-xs font-bold text-gray-900 dark:text-gray-100">${{ currentPrice.toFixed(2) }}</div>
                <div :class="['text-[10px] font-medium', (priceChange ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400']">
                    {{ (priceChange ?? 0) >= 0 ? '+' : '' }}{{ priceChange?.toFixed(2) }}%
                </div>
            </div>
            <div v-else-if="loading" class="w-12 h-4 bg-gray-100 dark:bg-zinc-800 animate-pulse rounded"></div>
        </div>
        
        <div class="flex-1 relative min-h-[50px] w-full">
            <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
                 <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div v-else-if="!error && chartData.labels.length > 0" class="absolute inset-0">
                <Line :data="chartData" :options="chartOptions" />
            </div>
            <div v-else-if="error" class="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">
                N/A
            </div>
        </div>
    </div>
</template>
