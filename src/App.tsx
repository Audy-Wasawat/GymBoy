import { HashRouter, Outlet, Route, Routes } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { useT } from './i18n/useT'
import { More } from './pages/More'
import { SettingsPage } from './pages/Settings'
import { Soon } from './pages/Soon'
import { Today } from './pages/Today'
import { DayEditor } from './pages/weights/DayEditor'
import { ExerciseDetail } from './pages/weights/ExerciseDetail'
import { ExerciseHistory } from './pages/weights/ExerciseHistory'
import { History } from './pages/weights/History'
import { HistoryDetail } from './pages/weights/HistoryDetail'
import { ExerciseLibrary } from './pages/weights/ExerciseLibrary'
import { ExerciseNew } from './pages/weights/ExerciseNew'
import { ProgramDetail } from './pages/weights/ProgramDetail'
import { Programs } from './pages/weights/Programs'
import { SessionPage } from './pages/weights/Session'
import { StaleSessionPrompt } from './pages/weights/StaleSessionPrompt'
import { Weights } from './pages/weights/Weights'
import { Running } from './pages/running/Running'
import { RunEditor } from './pages/running/RunEditor'
import { RunCharts } from './pages/running/RunCharts'
import { Templates } from './pages/running/Templates'
import { Shoes } from './pages/Shoes'

function Shell() {
  return (
    <div style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}>
      <Outlet />
      <TabBar />
      <StaleSessionPrompt />
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
        <Route path="weights/exercises/:id/history" element={<ExerciseHistory />} />
        <Route path="weights/history" element={<History />} />
        <Route path="weights/history/:id" element={<HistoryDetail />} />
        <Route path="weights/programs" element={<Programs />} />
        <Route path="weights/programs/:id" element={<ProgramDetail />} />
        <Route path="weights/programs/:id/days/:dayId" element={<DayEditor />} />
        <Route path="weights/session" element={<SessionPage />} />
        <Route path="running" element={<Running />} />
        <Route path="running/new" element={<RunEditor />} />
        <Route path="running/charts" element={<RunCharts />} />
        <Route path="running/templates" element={<Templates />} />
        <Route path="running/:id" element={<RunEditor />} />
        <Route path="food" element={<Soon title={t('food.title')} />} />
        <Route path="more" element={<More />} />
        <Route path="more/summary" element={<Soon title={t('more.summary')} back="/more" />} />
        <Route path="more/body" element={<Soon title={t('more.body')} back="/more" />} />
        <Route path="more/activities" element={<Soon title={t('more.activities')} back="/more" />} />
        <Route path="more/shoes" element={<Shoes />} />
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
