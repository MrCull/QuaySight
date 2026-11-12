import { createApp } from 'vue'
import { createPinia } from 'pinia'

// The three faces are bundled, so demo mode keeps its type offline (design-system README, Type).
import '@fontsource/barlow-condensed/latin-500.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import '../design-system/tokens.css'
import '../design-system/components/bundle.css'
import './styles/results.css'
import './styles/setup.css'
import './styles/atmosphere.css'

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
