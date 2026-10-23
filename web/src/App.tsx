import { Route, Routes } from 'react-router';
import { RequireAuth } from './auth/RequireAuth';
import { RequireReferent } from './auth/RequireReferent';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { MyRegistrationsPage } from './pages/MyRegistrationsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PlanningPage } from './pages/PlanningPage';
import { ReferentInitiationsPage } from './pages/ReferentInitiationsPage';
import { ReferentSlotPage } from './pages/ReferentSlotPage';
import { RegisterPage } from './pages/RegisterPage';

/** The header, then the page of the current URL. */
const App = () => {
  return (
    <main className="app">
      <Header />
      <Routes>
        <Route
          path="/"
          element={
            <RequireAuth>
              <PlanningPage />
            </RequireAuth>
          }
        />
        <Route
          path="/my-registrations"
          element={
            <RequireAuth>
              <MyRegistrationsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/referent/initiations"
          element={
            <RequireAuth>
              <RequireReferent>
                <ReferentInitiationsPage />
              </RequireReferent>
            </RequireAuth>
          }
        />
        <Route
          path="/referent/slots/:date/:hour"
          element={
            <RequireAuth>
              <RequireReferent>
                <ReferentSlotPage />
              </RequireReferent>
            </RequireAuth>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </main>
  );
};

export default App;
