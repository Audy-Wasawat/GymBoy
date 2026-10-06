import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { installAudioKeeper } from './lib/sound'
import App from './App'
import { ensureSettings } from './db/db'
import { seedExercises } from './db/seed'
import { recomputeAllBodyParts } from './db/sessions'
import { isStandalone, requestPersistence } from './lib/storage'
import './index.css'

registerSW({ immediate: true })
// Re-arms the rest-timer sound after iOS stops it (app sent to the background, a call, other audio).
installAudioKeeper()

ensureSettings().then(() => {
  // Installed apps get the best chance of keeping data; ask once on launch.
  if (isStandalone()) requestPersistence()
})
// Body parts of past sessions follow the exercises' current body parts (custom exercises use their muscles).
seedExercises().then(recomputeAllBodyParts)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
