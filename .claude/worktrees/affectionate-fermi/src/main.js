import { createApp } from 'vue'
import App from './App.vue'
import router from './router/routes.js'

const app = createApp(App)
app.use(router)
app.mount('#app')

// `main.js` is the application's entry point where you:
// - Initialize the Vue application
// - Configure global plugins (like Vue Router)
// - Mount the app to the DOM

import MetaImage from './assets/images/computrek-cs-preview-min.jpg';
