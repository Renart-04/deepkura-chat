import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

import { auth } from './firebase/config'
import { onAuthStateChanged } from 'firebase/auth'

let app: any

onAuthStateChanged(auth, () => {
    if (!app) {
        app = createApp(App).use(router).mount('#app')
    }
})
