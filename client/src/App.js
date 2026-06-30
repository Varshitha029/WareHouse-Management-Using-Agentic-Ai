import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { LanguageProvider, useTranslation } from './i18n/LanguageContext';
import LanguageSelector from './components/LanguageSelector';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import AIChat from './components/AIChat';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import WeighBridge from './pages/WeighBridge';
import OwnerDashboard from './pages/OwnerDashboard';
import CustomerDashboard from './pages/CustomerDashboard';
import VehicleManagement from './pages/VehicleManagement';
import TransactionManagement from './pages/TransactionManagement';
import UserProfile from './pages/UserProfile';
import PaymentManagement from './pages/PaymentManagement';
import EvaluationDashboard from './pages/EvaluationDashboard';
import './App.css';

// Create Material-UI theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      dark: '#115293',
      light: '#42a5f5'
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5'
    }
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    }
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600
        }
      }
    }
  }
});

function LanguageGate({ children }) {
  const [languageSelected, setLanguageSelected] = useState(false);
  const { changeLanguage } = useTranslation();

  const handleLanguageSelect = (lang) => {
    changeLanguage(lang);
    setLanguageSelected(true);
  };

  if (!languageSelected) {
    return <LanguageSelector onSelect={handleLanguageSelect} open={true} />;
  }

  return children;
}

function CustomerOnlyAIChat() {
  const { user } = useAuth();
  if (user?.role !== 'customer') return null;
  return <AIChat />;
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <LanguageProvider>
        <LanguageGate>
        <SocketProvider>
          <Router>
            <div className="App">
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                
                {/* Owner Only Routes */}
                <Route path="/owner-dashboard" element={
                  <ProtectedRoute allowedRoles={['owner']}>
                    <Navbar />
                    <OwnerDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/weigh-bridge" element={
                  <ProtectedRoute allowedRoles={['owner']}>
                    <Navbar />
                    <WeighBridge />
                  </ProtectedRoute>
                } />
                <Route path="/vehicles" element={
                  <ProtectedRoute allowedRoles={['owner']}>
                    <Navbar />
                    <VehicleManagement />
                  </ProtectedRoute>
                } />
                <Route path="/transactions" element={
                  <ProtectedRoute allowedRoles={['owner']}>
                    <Navbar />
                    <TransactionManagement />
                  </ProtectedRoute>
                } />
                <Route path="/evaluation" element={
                  <ProtectedRoute allowedRoles={['owner']}>
                    <Navbar />
                    <EvaluationDashboard />
                  </ProtectedRoute>
                } />
                
                {/* Customer Only Routes */}
                <Route path="/customer-dashboard" element={
                  <ProtectedRoute allowedRoles={['customer']}>
                    <Navbar />
                    <CustomerDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/payments" element={
                  <ProtectedRoute allowedRoles={['customer']}>
                    <Navbar />
                    <PaymentManagement />
                  </ProtectedRoute>
                } />
                
                {/* Shared Routes */}
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <Navbar />
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Navbar />
                    <UserProfile />
                  </ProtectedRoute>
                } />
                
                {/* Default Route - Redirect to login */}
                <Route path="/" element={<Login />} />
              </Routes>
              
              {/* AI Chat - Customer only */}
              <CustomerOnlyAIChat />
            </div>
          </Router>
        </SocketProvider>
        </LanguageGate>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
