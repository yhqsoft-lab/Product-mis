//src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter as Router } from 'react-router-dom';
import { ToastProvider } from './components/ToastProvider';

ReactDOM.createRoot(document.getElementById('root')).render(
  <ToastProvider>
    <Router>
      <App />
    </Router>
  </ToastProvider>
);
