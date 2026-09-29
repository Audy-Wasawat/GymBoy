import { HashRouter, Outlet, Route, Routes } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { useT } from './i18n/useT'
import { More } from './pages/More'
import { SettingsPage } from './pages/Settings'
import { Soon } from './pages/Soon'
import { Today } from './pages/Today'
import { ExerciseDetail } from './pages/weights/ExerciseDetail'
import { ExerciseLibrary } from './pages/weights/ExerciseLibrary'
import { ExerciseNew } from './pages/weights/ExerciseNew'
import { Weights } from './pages/weights/Weights'

function Shell() {
  return (
    <div style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}>
      <Outlet />
      <TabBar />
    </div>
  )
}

function AppRoutes() {
  const t = useT()
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Today />} />
        <Route path="weights" element={<Weights />} />
        <Route path="weights/exercises" element={<ExerciseLibrary />} />
        <Route path="weights/exercises/new" element={<ExerciseNew />} />
        <Route path="weights/exercises/:id" element={<ExerciseDetail />} />
        <Route path="running" element={<Soon title={t('running.title')} />} />
        <Route path="food" element={<Soon title={t('food.title')} />} />
        <Route path="more" element={<More />} />
        <Route path="more/summary" element={<Soon title={t('more.summary')} back="/more" />} />
        <Route path="more/body" element={<Soon title={t('more.body')} back="/more" />} />
        <Route path="more/activities" element={<Soon title={t('more.activities')} back="/more" />} />
        <Route path="more/shoes" element={<Soon title={t('more.shoes')} back="/more" />} />
        <Route path="more/backup" element={<Soon title={t('more.backup')} back="/more" />} />
        <Route path="more/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  )
}
