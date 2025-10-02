import React, { useState } from 'react';
import axios from 'axios';
import logo from './img/Logo-Azenha.png';
import './Login.css';
import { useTheme } from './ThemeContext';
import API_URL from './config/api';

function AdminLogin({ onAdminLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/admin/login`, {
        email,
        password,
      });
      
      console.log('Login de Administrador bem-sucedido!', response.data);
      onAdminLoginSuccess(response.data); // Passa os dados completos para o App.js
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao tentar fazer login de administrador.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-utility-header">
          <button onClick={toggleTheme} className="theme-toggle-btn">
            {theme === 'light' ? '🌙 Modo Escuro' : '☀️ Modo Claro'}
          </button>
        </div>
        
        <img src={logo} alt="Logo Azenha" className="login-logo" />
        <h2>Acesso do Administrador</h2>
        <p className="login-subtitle">Gerencie todos os lançamentos da aplicação.</p>
        
        <form className="login-form" onSubmit={handleAdminLogin}>
          {error && <p className="error-message">{error}</p>}
          
          <div className="form-group">
            <label htmlFor="email">E-mail</label>
            <input 
              type="email" 
              id="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              placeholder="Digite seu e-mail de administrador"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input 
              type="password" 
              id="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="Digite sua senha"
            />
          </div>
          
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar como Admin'}
          </button>
        </form>
        
        <div className="login-footer">
          <p className="login-note">
            <a href="/">← Voltar para login de cliente</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;