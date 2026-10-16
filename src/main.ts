import { createApp } from 'vue'
import { createPinia } from 'pinia'

import '../design-system/tokens.css'
import '../design-system/components/bundle.css'
import './styles/results.css'
import './styles/setup.css'

import App from './App.vue'
import router from './router'
import { useSetupStore } from './stores/setup'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
app.use(router)

// The remembered provider and model only; a refresh never brings back a key.
useSetupStore(pinia).restore()

app.mount('#app')
