import { ref } from 'vue'

const isLoading = ref(false)
const progress = ref(0)
let timer: any = null

export function useLoadingBar() {

    const start = () => {
        if (timer) clearInterval(timer)
        isLoading.value = true
        progress.value = 25 // Start at 25% to be visible immediately

        // Simulate progress
        timer = setInterval(() => {
            if (progress.value < 90) {
                // Slow down as it gets higher
                const increment = Math.max(0.5, (90 - progress.value) / 20)
                progress.value += increment
            }
        }, 100)
    }

    const finish = () => {
        if (timer) clearInterval(timer)
        progress.value = 100

        // Hide after short delay to show completion
        setTimeout(() => {
            isLoading.value = false
            setTimeout(() => {
                progress.value = 0
            }, 200)
        }, 300)
    }

    return {
        isLoading,
        progress,
        start,
        finish
    }
}
