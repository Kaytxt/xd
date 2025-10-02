import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ThemeProvider } from './ThemeContext';
import Login from './Login';
import MonthSelector from './MonthSelector';
import Dashboard from './Dashboard';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';
import AdminClientSelector from './AdminClientSelector';
import './App.css';
import API_URL from './config/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [clienteInfo, setClienteInfo] = useState(null);
  const [selectedAdminClient, setSelectedAdminClient] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const cliente = localStorage.getItem('cliente');
    const isAdmin = localStorage.getItem('isAdmin');
    
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      if (isAdmin === 'true') {
        setIsAdminAuthenticated(true);
        const adminClient = localStorage.getItem('selectedAdminClient');
        if (adminClient) {
          setSelectedAdminClient(JSON.parse(adminClient));
        }
      } else if (cliente) {
        setIsAuthenticated(true);
        setClienteInfo(JSON.parse(cliente));
      }
    }
  }, []);

  const handleLoginSuccess = (loginData) => {
    localStorage.setItem('token', loginData.access_token);
    localStorage.setItem('refresh_token', loginData.refresh_token);
    localStorage.setItem('user', JSON.stringify(loginData.user));
    
    if (loginData.cliente) {
      localStorage.setItem('cliente', JSON.stringify(loginData.cliente));
      setClienteInfo(loginData.cliente);
    }
    
    localStorage.setItem('isCliente', loginData.isCliente);
    axios.defaults.headers.common['Authorization'] = `Bearer ${loginData.access_token}`;
    setIsAuthenticated(true);
  };

  const handleAdminLoginSuccess = (loginData) => {
    localStorage.setItem('token', loginData.access_token);
    localStorage.setItem('refresh_token', loginData.refresh_token);
    localStorage.setItem('user', JSON.stringify(loginData.user));
    localStorage.setItem('isAdmin', 'true');
    axios.defaults.headers.common['Authorization'] = `Bearer ${loginData.access_token}`;
    setIsAdminAuthenticated(true);
  };

  const handleAdminClientSelect = (cliente) => {
    setSelectedAdminClient(cliente);
    localStorage.setItem('selectedAdminClient', JSON.stringify(cliente));
  };

  const handleMonthSelect = (month, year) => {
    setSelectedMonth(month);
    setSelectedYear(year);
  };

  const handleGoBack = () => {
    setSelectedMonth(null);
    setSelectedYear(null);
  };

  const handleLogout = () => {
    localStorage.clear();
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setIsAdminAuthenticated(false);
    setClienteInfo(null);
    setSelectedAdminClient(null);
    setSelectedMonth(null);
    setSelectedYear(null);
    window.location.href = '/';
  };
  
  const handleAdminLogout = () => {
    localStorage.clear();
    delete axios.defaults.headers.common['Authorization'];
    setIsAdminAuthenticated(false);
    setSelectedAdminClient(null);
    setSelectedMonth(null);
    setSelectedYear(null);
    window.location.href = '/admin';
  };

  const handleAdminGoBack = () => {
    setSelectedMonth(null);
    setSelectedYear(null);
  };

  // Componente interno para gerenciar a navegação do MonthSelector
  const MonthSelectorWrapper = ({ onSelectMonth, clienteInfo, onLogout, isAdmin }) => {
    const navigate = useNavigate();

    const handleSelectAndNavigate = (month, year) => {
      onSelectMonth(month, year);
      if (isAdmin) {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    };

    return (
      <MonthSelector 
        onSelectMonth={handleSelectAndNavigate}
        clienteInfo={clienteInfo}
        onLogout={onLogout}
      />
    );
  };

  return (
    <Router>
      <ThemeProvider>
        <div className="App">
          <Routes>
            {/* Rotas de Cliente */}
            <Route 
              path="/" 
              element={
                !isAuthenticated ? (
                  <Login onLoginSuccess={handleLoginSuccess} />
                ) : !selectedMonth || !selectedYear ? (
                  <MonthSelectorWrapper
                    onSelectMonth={handleMonthSelect}
                    clienteInfo={clienteInfo}
                    onLogout={handleLogout}
                    isAdmin={false}
                  />
                ) : (
                  <Navigate to="/dashboard" />
                )
              } 
            />

            <Route
              path="/dashboard"
              element={
                isAuthenticated && selectedMonth && selectedYear ? (
                  <Dashboard
                    selectedMonth={selectedMonth} 
                    selectedYear={selectedYear} 
                    onGoBack={handleGoBack}
                    clienteInfo={clienteInfo}
                  />
                ) : (
                  <Navigate to="/" />
                )
              }
            />

            {/* Rotas de Admin */}
            <Route 
              path="/admin" 
              element={
                !isAdminAuthenticated ? (
                  <AdminLogin onAdminLoginSuccess={handleAdminLoginSuccess} />
                ) : (
                  <Navigate to="/admin/select-client" />
                )
              } 
            />

            <Route
              path="/admin/select-client"
              element={
                isAdminAuthenticated ? (
                  <AdminClientSelector
                    onSelectClient={handleAdminClientSelect}
                    onLogout={handleAdminLogout}
                  />
                ) : (
                  <Navigate to="/admin" />
                )
              }
            />

            <Route 
              path="/admin/select-month"
              element={
                isAdminAuthenticated && selectedAdminClient ? (
                  <MonthSelectorWrapper 
                    onSelectMonth={handleMonthSelect}
                    clienteInfo={selectedAdminClient}
                    onLogout={handleAdminLogout}
                    isAdmin={true}
                  />
                ) : (
                  <Navigate to="/admin/select-client" />
                )
              }
            />

            <Route 
              path="/admin/dashboard" 
              element={
                isAdminAuthenticated && selectedAdminClient && selectedMonth && selectedYear ? (
                  <AdminDashboard 
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    onGoBack={handleAdminGoBack}
                    onLogout={handleAdminLogout}
                    clienteInfo={selectedAdminClient}
                  />
                ) : isAdminAuthenticated && selectedAdminClient ? (
                  <Navigate to="/admin/select-month" />
                ) : isAdminAuthenticated ? (
                  <Navigate to="/admin/select-client" />
                ) : (
                  <Navigate to="/admin" />
                )
              }
            />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </ThemeProvider>
    </Router>
  );
}

export default App;