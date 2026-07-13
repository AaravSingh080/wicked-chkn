import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AdminProvider } from './store.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AdminProvider>
        <App />
      </AdminProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
