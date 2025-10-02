import React, { useState } from 'react';
import { useTheme } from './ThemeContext';
import './MonthSelector.css';
import API_URL from './config/api';

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function MonthSelector({ onSelectMonth, clienteInfo, onLogout }) {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear(); 
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="month-selector-container">
      <div className="month-selector-card">
        <div className="selector-header">
          <div className="client-info">
            <h3>Bem-vindo(a), {clienteInfo?.nome || 'Usuário'}</h3>
            <span className="client-email">{clienteInfo?.email}</span>
          </div>
          <div className="header-actions">
            <button onClick={toggleTheme} className="theme-toggle-btn">
              {theme === 'light' ? '🌙 Modo Escuro' : '☀️ Modo Claro'}
            </button>
            <button onClick={onLogout} className="logout-btn">
              Sair
            </button>
          </div>
        </div>

        <div className="year-selector">
          <button 
            className="nav-button" 
            onClick={() => setSelectedYear(selectedYear - 1)}
          >
            &lt;
          </button>
          <h2>{selectedYear}</h2>
          {/*
            *** ALTERAÇÃO AQUI ***
            A condição "{selectedYear < currentYear && (...)}" foi removida,
            permitindo que o botão de avançar (>) apareça sempre.
          */}
          <button 
            className="nav-button" 
            onClick={() => setSelectedYear(selectedYear + 1)}
          >
            &gt;
          </button>
          
        </div>

        <div className="month-grid">
          {months.map((month, index) => {
            return (
              <button
                key={index}
                className={`month-button`} 
                onClick={() => onSelectMonth(index + 1, selectedYear)}
              >
                {month}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default MonthSelector;