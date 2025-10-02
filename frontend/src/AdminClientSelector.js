import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTheme } from './ThemeContext';
import './AdminClientSelector.css';
import { useNavigate } from 'react-router-dom';
import API_URL from './config/api';

function AdminClientSelector({ onSelectClient, onLogout }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const response = await axios.get(`${API_URL}/api/admin/clients`, config);
        
        if (Array.isArray(response.data)) {
          setClients(response.data);
        } else {
          setClients([]);
          setError('A resposta da API não contém uma lista de clientes válida.');
        }
      } catch (err) {
        console.error('Erro ao buscar clientes:', err.response?.data?.error || err.message);
        setError('Erro ao carregar a lista de clientes. Verifique o console para mais detalhes.');
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, []);

  const handleSelectAndNavigate = (client) => {
    onSelectClient(client);
    // Navega para a rota de seleção de mês de admin com o cliente selecionado
    navigate(`/admin/select-month`);
  };

  return (
    <div className="admin-client-container">
      <div className="admin-client-card">
        <div className="header-container">
          <h2 className="card-title">Selecione um Cliente</h2>
          <div className="utility-group">
            <button onClick={toggleTheme} className="theme-toggle-btn">
              {theme === 'light' ? '🌙 Modo Escuro' : '☀️ Modo Claro'}
            </button>
            <button onClick={onLogout} className="logout-btn">
              Sair
            </button>
          </div>
        </div>
        <p className="selector-subtitle">Escolha um cliente para visualizar os lançamentos.</p>
        
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Carregando clientes...</p>
          </div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <div className="client-grid">
            {clients.length === 0 ? (
              <div className="empty-state">Nenhum cliente encontrado.</div>
            ) : (
              clients.map(client => (
                <button
                  key={client.id}
                  className="client-card-button"
                  onClick={() => handleSelectAndNavigate(client)}
                >
                  {client.nome}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminClientSelector;
