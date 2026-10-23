import { Route, Routes } from 'react-router';
import { RequireAuth } from './auth/RequireAuth';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PlanningPage } from './pages/PlanningPage';
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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </main>
  );
};

export default App;
