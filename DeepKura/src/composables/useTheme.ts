import { ref, onMounted } from 'vue'

const isDarkMode = ref(false)

export function useTheme() {
    const toggleDarkMode = (value?: boolean) => {
        isDarkMode.value = value ?? !isDarkMode.value
        if (isDarkMode.value) {
            document.documentElement.classList.add('dark')
            localStorage.setItem('theme', 'dark')
        } else {
            document.documentElement.classList.remove('dark')
            localStorage.setItem('theme', 'light')
        }
    }

    onMounted(() => {
        const savedTheme = localStorage.getItem('theme')
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            toggleDarkMode(true)
        } else {
            toggleDarkMode(false)
        }
    })

    return {
        isDarkMode,
        toggleDarkMode
    }
}
