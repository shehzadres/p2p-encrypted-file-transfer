import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { AppProvider } from '@/store/appStore';
import { ThemeProvider } from '@/hooks/useTheme';
import { ToastContainer } from '@/components/ui/Toast';
import { useNotifications } from '@/hooks/useNotifications';
import HomePage from '@/pages/HomePage';
import TransferPage from '@/pages/TransferPage';
import ReceivePage from '@/pages/ReceivePage';
import NotFoundPage from '@/pages/NotFoundPage';

function AppInner() {
  // Mount notification watcher inside AppProvider context
  useNotifications();
  return (
    <>
      <AppShell>
        <Routes>
          <Route path="/"                  element={<HomePage     />} />
          <Route path="/room/:roomId"      element={<TransferPage />} />
          <Route path="/receive/:roomId"   element={<ReceivePage  />} />
          <Route path="*"                  element={<NotFoundPage />} />
        </Routes>
      </AppShell>
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <BrowserRouter>
          <AppInner />
        </BrowserRouter>
      </AppProvider>
    </ThemeProvider>
  );
}
