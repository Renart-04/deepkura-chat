<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

interface StockData {
    ticker: string;
    price: number;
    change: number;
    loading: boolean;
}

const currentStock = ref<StockData | null>(null);
const tickers = ref<string[]>([]);
let currentIndex = 0;
let rotationInterval: number | null = null;

const fetchTickers = async () => {
    try {
        const response = await fetch('/stocks.txt');
        if (!response.ok) throw new Error('Failed to load stock list');
        const text = await response.text();
        tickers.value = text
            .split('\n')
            .map(t => t.trim())
            .filter(t => t.length > 0 && !t.startsWith('#'));
        
        if (tickers.value.length > 0) {
            updateTicker();
            startRotation();
        }
    } catch (e) {
        console.error('Error loading stocks.txt:', e);
        // Fallback
        tickers.value = ['AAPL', 'NVDA', 'TSLA', 'MSFT'];
        updateTicker();
        startRotation();
    }
};

const fetchStockData = async (ticker: string): Promise<StockData | null> => {
    try {
        const response = await fetch(`/api/chart/intraday/${ticker}`);
        if (!response.ok) return null;
        
        const result = await response.json();
        if (result.data && result.data.length > 0) {
            const latest = result.data[result.data.length - 1];
            return {
                ticker,
                price: latest.price,
                change: latest.change_pct,
                loading: false
            };
        }
        return null;
    } catch (e) {
        return null; // Silent fail
    }
};

const updateTicker = async () => {
    if (tickers.value.length === 0) return;
    
    // Get current ticker
    const ticker = tickers.value[currentIndex];
    if (!ticker) return;

    const data = await fetchStockData(ticker);
    if (data) {
        currentStock.value = data;
    }
    
    // Move index for next time
    currentIndex = (currentIndex + 1) % tickers.value.length;
};

const startRotation = () => {
    if (rotationInterval) clearInterval(rotationInterval);
    // Rotate every 4 seconds
    rotationInterval = setInterval(updateTicker, 4000);
};

onMounted(() => {
    fetchTickers();
});

onUnmounted(() => {
    if (rotationInterval) clearInterval(rotationInterval);
});
</script>

<template>
  <div v-if="currentStock" class="px-2 mb-1">
    <div class="flex items-center justify-between w-full p-2.5 bg-[#e8eef6] dark:bg-[#1f1f1f] rounded-lg border border-gray-100 dark:border-[#333]">
        <div class="flex items-center gap-2">
            <span class="font-bold text-sm text-gray-900 dark:text-gray-100">{{ currentStock.ticker }}</span>
        </div>
        <div class="flex items-center gap-2 text-xs font-mono">
            <span class="text-gray-700 dark:text-gray-300">${{ currentStock.price.toFixed(2) }}</span>
            <span :class="currentStock.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                {{ currentStock.change >= 0 ? '+' : '' }}{{ currentStock.change.toFixed(2) }}%
            </span>
        </div>
    </div>
  </div>
</template>

<style scoped>
/* Optional transition for smooth update if needed */
</style>
