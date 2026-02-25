<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import { Loader2 } from 'lucide-vue-next'

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const username = ref('')
const { login, register, googleLogin } = useAuth()
const error = ref('')
const isLogin = ref(true)
const isFormLoading = ref(false)
const isGoogleLoading = ref(false)

const handleSubmit = async () => {
    error.value = ''
    isFormLoading.value = true
    try {
        if (isLogin.value) {
            await login(email.value, password.value)
        } else {
            if (password.value !== confirmPassword.value) {
                error.value = "Passwords do not match."
                return
            }
            if (!username.value.trim()) {
                error.value = "Username is required."
                return
            }
            await register(email.value, password.value, username.value)
        }
    } catch (e: any) {
        // Map common firebase errors to readable messages
        if (e.code === 'auth/invalid-credential') {
            error.value = 'Invalid email or password.'
        } else if (e.code === 'auth/email-already-in-use') {
            error.value = 'Email already in use.'
        } else if (e.code === 'auth/weak-password') {
            error.value = 'Password should be at least 6 characters.'
        } else {
            error.value = e.message
        }
    } finally {
        isFormLoading.value = false
    }
}

const handleGoogleLogin = async () => {
    error.value = ''
    isGoogleLoading.value = true
    try {
        await googleLogin()
    } catch (e: any) {
        // Handle popup cancellation gracefully
        if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
            error.value = 'Proses login dibatalkan.'
        } else {
            error.value = e.message
        }
    } finally {
        isGoogleLoading.value = false
    }
}
</script>

<template>
    <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-300 p-3 md:p-4">
        <div class="max-w-[400px] w-full space-y-5 md:space-y-8 p-5 md:p-10 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-[#262626] relative overflow-hidden">
            <!-- Decorative gradient removed for softer look -->

            <div class="text-center">
                <!-- Logo Lockup -->
                <div class="flex items-center justify-center gap-2 mb-5 md:mb-8">
                    <span class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">DeepKura</span>
                </div>

                <h2 class="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                    {{ isLogin ? 'Welcome back' : 'Create an account' }}
                </h2>
                <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {{ isLogin ? 'Enter your details to access your workspace.' : 'Start your journey with DeepKura today.' }}
                </p>
            </div>
            
            <form class="mt-5 md:mt-8 space-y-5" @submit.prevent="handleSubmit">
                <!-- Error Alert (Minimalist) -->
                <div v-if="error" class="text-red-500 text-sm text-center">
                    {{ error }}
                </div>

                <div class="space-y-4">
                    <div v-if="!isLogin">
                        <label for="username" class="sr-only">Username</label>
                        <input id="username" name="username" type="text" autocomplete="username"
                            v-model="username"
                            class="appearance-none block w-full px-4 py-2.5 md:py-3 bg-gray-50 dark:bg-[#222] border border-transparent dark:border-[#333] focus:bg-white dark:focus:bg-[#222] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 transition-all text-sm"
                            placeholder="Username" />
                    </div>

                    <div>
                        <label for="email-address" class="sr-only">Email address</label>
                        <input id="email-address" name="email" type="email" autocomplete="email" required
                            v-model="email"
                            class="appearance-none block w-full px-4 py-2.5 md:py-3 bg-gray-50 dark:bg-[#222] border border-transparent dark:border-[#333] focus:bg-white dark:focus:bg-[#222] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 transition-all text-sm"
                            placeholder="Email address" />
                    </div>
                    
                    <div>
                        <label for="password" class="sr-only">Password</label>
                        <input id="password" name="password" type="password" autocomplete="current-password" required
                            v-model="password"
                            class="appearance-none block w-full px-4 py-2.5 md:py-3 bg-gray-50 dark:bg-[#222] border border-transparent dark:border-[#333] focus:bg-white dark:focus:bg-[#222] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 transition-all text-sm"
                            placeholder="Password" />
                    </div>

                    <div v-if="!isLogin">
                        <label for="confirm-password" class="sr-only">Confirm Password</label>
                        <input id="confirm-password" name="confirm-password" type="password" autocomplete="new-password"
                            v-model="confirmPassword"
                            class="appearance-none block w-full px-4 py-2.5 md:py-3 bg-gray-50 dark:bg-[#222] border border-transparent dark:border-[#333] focus:bg-white dark:focus:bg-[#222] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 transition-all text-sm"
                            placeholder="Confirm Password" />
                    </div>
                </div>

                <div>
                    <button type="submit"
                        :disabled="isFormLoading || isGoogleLoading"
                        class="group relative w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white dark:text-gray-900 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 focus:outline-none transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed">
                        <Loader2 v-if="isFormLoading" class="w-4 h-4 animate-spin" />
                        {{ isFormLoading ? (isLogin ? 'Signing in...' : 'Creating account...') : (isLogin ? 'Sign in' : 'Create account') }}
                    </button>
                </div>
            </form>

            <div class="mt-6">
                <div class="relative">
                    <div class="absolute inset-0 flex items-center">
                        <div class="w-full border-t border-gray-200 dark:border-[#262626]"></div>
                    </div>
                    <div class="relative flex justify-center text-sm">
                        <span class="px-2 bg-white dark:bg-[#171717] text-gray-500">
                            Or continue with
                        </span>
                    </div>
                </div>

                <div class="mt-6">
                    <button @click="handleGoogleLogin"
                        :disabled="isGoogleLoading || isFormLoading"
                        class="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-100 dark:border-[#333] rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 bg-transparent hover:bg-gray-50 dark:hover:bg-[#222] focus:outline-none transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                        <Loader2 v-if="isGoogleLoading" class="w-5 h-5 animate-spin" />
                        <svg v-else class="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        {{ isLogin ? 'Sign in with Google' : 'Sign up with Google' }}
                    </button>
                </div>
            </div>
            
            <div class="text-center">
                 <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ isLogin ? "Don't have an account?" : "Already have an account?" }}
                    <button @click="isLogin = !isLogin" class="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors ml-1">
                        {{ isLogin ? 'Sign up' : 'Sign in' }}
                    </button>
                </p>
            </div>
        </div>
    </div>
</template>
