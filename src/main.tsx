import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { FirebaseProvider } from './contexts/FirebaseContext';
import { PortfolioContentProvider } from './contexts/PortfolioContentContext';
import './index.css';
import './theme/lightTheme.css';
import './theme/accentThemes.css';
import { ThemeProvider } from './theme/ThemeProvider';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <ThemeProvider>
      <FirebaseProvider>
        <PortfolioContentProvider>
          <App />
        </PortfolioContentProvider>
      </FirebaseProvider>
    </ThemeProvider>
  </ErrorBoundary>
);
