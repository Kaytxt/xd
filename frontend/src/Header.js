// Header.js

import React from 'react';
import './Header.css';
import logo from './img/Logo-Azenha.png'; // NOVO: Importe a sua logo

function Header() {
  return (
    <header className="header">
      <div className="header-content">
        {/* NOVO: Wrapper para a logo e o texto */}
        <div className="logo-section">
          <img src={logo} alt="Logo Azenha" className="logo-image" />
          <div className="logo-text-wrapper">
            <h1 className="logo-text">AZENHA</h1>
            <span className="logo-subtitle">CONSULTORIA</span>
          </div>
        </div>
        {/* O resto do seu header... */}
      </div>
    </header>
  );
}

export default Header;