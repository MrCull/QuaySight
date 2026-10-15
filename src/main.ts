import { createApp } from 'vue'
import { createPinia } from 'pinia'

import '../design-system/tokens.css'
import '../design-system/components/bundle.css'
import './styles/results.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
