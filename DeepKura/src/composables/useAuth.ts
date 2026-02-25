import { ref } from 'vue'
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    updateProfile,
    type User
} from 'firebase/auth'
import { auth } from '../firebase/config'
import { useRouter } from 'vue-router'
import { useUserPlan } from './useUserPlan'

const user = ref<User | null>(null)
const loading = ref(true)

// Initialize auth listener globally
onAuthStateChanged(auth, async (u) => {
    user.value = u
    if (u) {
        // Initialize/Sync User Plan on login
        const { initPlan } = useUserPlan()
        await initPlan()
    }
    loading.value = false
})

export function useAuth() {
    const router = useRouter() // Note: might not work outside of setup in some cases, but okay for actions called from components

    const login = async (email: string, pass: string) => {
        try {
            await signInWithEmailAndPassword(auth, email, pass)
            router.push('/')
        } catch (e) {
            console.error(e)
            throw e
        }
    }

    const register = async (email: string, pass: string, username: string) => {
        try {
            const result = await createUserWithEmailAndPassword(auth, email, pass)
            if (result.user) {
                await updateProfile(result.user, {
                    displayName: username
                })
            }
            router.push('/')
        } catch (e) {
            console.error(e)
            throw e
        }
    }

    const logout = async () => {
        try {
            await signOut(auth)
            // No redirect - let the user stay on the current page
        } catch (e) {
            console.error(e)
        }
    }

    const googleLogin = async () => {
        try {
            const provider = new GoogleAuthProvider()
            await signInWithPopup(auth, provider)
            router.push('/')
        } catch (e) {
            console.error(e)
            throw e
        }
    }

    return {
        user,
        loading,
        login,
        register,
        logout,
        googleLogin
    }
}
