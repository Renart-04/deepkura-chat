import { createRouter, createWebHistory } from 'vue-router'
import { auth } from '../firebase/config'
import ChatView from '../views/ChatView.vue'
import { useLoadingBar } from '../composables/useLoadingBar'

const { start, finish } = useLoadingBar()

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: ChatView,
            meta: { title: 'Chat & Analysis - DeepKura' }
        },
        {
            path: '/login',
            name: 'login',
            component: () => import('../views/LoginView.vue'),
            meta: { title: 'Login & Access - DeepKura', guestOnly: true }
        },

        {
            path: '/policy',
            name: 'policy',
            component: () => import('../views/PolicyView.vue'),
            meta: { title: 'Privacy Policy - DeepKura' }
        },
        {
            path: '/market-charts',
            name: 'market-charts',
            component: () => import('../views/MarketView.vue'),
            meta: { title: 'Market Charts - DeepKura', requiresAuth: true }
        },
        {
            path: '/news',
            name: 'news',
            component: () => import('../views/NewsView.vue'),
            meta: { title: 'Market News - DeepKura', requiresAuth: true }
        },
        {
            path: '/:pathMatch(.*)*',
            redirect: '/'
        }
    ]
})

router.beforeEach(async (to, _from, next) => {
    start() // Start Loading Bar

    const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
    const guestOnly = to.matched.some(record => record.meta.guestOnly)

    if (requiresAuth || guestOnly) {
        // Wait for auth to initialize with timeout
        const currentUser = await new Promise((resolve) => {
            // Check immediately if already initialized
            if (auth.currentUser) {
                resolve(auth.currentUser)
                return
            }

            const unsubscribe = auth.onAuthStateChanged((user) => {
                unsubscribe()
                resolve(user)
            })
            // Timeout after 5 seconds
            setTimeout(() => {
                resolve(null)
            }, 5000)
        })

        // Explicitly handle "requiresAuth" failure
        if (requiresAuth && !currentUser) {
            next({ path: '/login', replace: true })
        }
        // Explicitly handle "guestOnly" failure (e.g. user is logged in trying to view login page)
        else if (guestOnly && currentUser) {
            next({ path: '/', replace: true })
        }
        // Proceed normally
        else {
            next()
        }
    } else {
        next()
    }
})

router.afterEach((to) => {
    finish() // Finish Loading Bar
    if (to.meta.title) {
        document.title = to.meta.title as string
    }
})

router.onError(() => {
    finish() // Ensure it finishes on error
})

export default router
