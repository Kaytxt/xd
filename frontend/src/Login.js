import React, { useState } from 'react';
import axios from 'axios';
import logo from './img/Logo-Azenha.png';
import './Login.css';
import { useTheme } from './ThemeContext';
import API_URL from './config/api';

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/login`, {
        email,
        password,
      });
      
      console.log('Login bem-sucedido!', response.data);
      
      // Salvar token e informações do cliente no localStorage
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('refresh_token', response.data.refresh_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      if (response.data.cliente) {
        localStorage.setItem('cliente', JSON.stringify(response.data.cliente));
      }
      
      localStorage.setItem('isCliente', response.data.isCliente);
      
      // Configurar o token no axios para futuras requisições
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
      
      onLoginSuccess(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao tentar fazer login.');
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
        <h2>Acesso ao Sistema</h2>
        <p className="login-subtitle">Acompanhe seus lançamentos de forma simples e eficaz.</p>
        
        <form className="login-form" onSubmit={handleLogin}>
          {error && <p className="error-message">{error}</p>}
          
          <div className="form-group">
            <label htmlFor="email">E-mail</label>
            <input 
              type="email" 
              id="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              placeholder="Digite seu e-mail"
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
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
