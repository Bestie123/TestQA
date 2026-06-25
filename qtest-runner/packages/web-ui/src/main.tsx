import { StrictMode, Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Ошибка</h2>
        <pre style={{ color: '#f44336', marginTop: 12 }}>{this.state.error.message}</pre>
        <button style={{ marginTop: 16, padding: '8px 20px' }} onClick={() => window.location.reload()}>Обновить страницу</button>
      </div>;
    }
    return this.props.children;
  }
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}
