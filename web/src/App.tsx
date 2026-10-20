import { Route, Routes } from 'react-router';
import { RequireAuth } from './auth/RequireAuth';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PlanningPage } from './pages/PlanningPage';

/**
 * The frame of every page: the header, then the page of the current URL.
 *
 * The order of the routes does not matter: React Router picks the most
 * precise one, and * comes last. The planning is for the logged-in only.
 */
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
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </main>
  );
};

export default App;
