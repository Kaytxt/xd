import React, { createContext, useState, useEffect, useContext } from 'react';

// 1. Cria o Contexto
const ThemeContext = createContext();

// 2. Cria o Provider (Componente que irá envolver toda a aplicação)
export const ThemeProvider = ({ children }) => {
  // Estado inicial lendo de localStorage ou definindo 'light'
  const [theme, setTheme] = useState(
    localStorage.getItem('theme') || 'light'
  );

  // Efeito para aplicar a classe 'dark-mode' ao body
  useEffect(() => {
    document.body.className = theme === 'dark' ? 'dark-mode' : '';
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Função para alternar o tema
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// 3. Hook Customizado para fácil uso em qualquer componente
export const useTheme = () => {
  return useContext(ThemeContext);
};
