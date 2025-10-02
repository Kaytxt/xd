// Dashboard.js

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
// PASSO 1: Importar o useTheme
import { useTheme } from './ThemeContext'; 
import API_URL from './config/api';



function Dashboard({ selectedMonth, selectedYear, onGoBack }) {
  // PASSO 2: Acessar o theme e toggleTheme
  const { theme, toggleTheme } = useTheme();

  const [lancamento, setLancamento] = useState({
    fornecedor: '', contaDesmembrada: 'nao', categoria: '', contaCorrente: '',
    dataCompra: '', valorCompra: '', quantidadeParcelas: '', valorParcela: '',
    parcelaAtual: '', dataVencimento: '', tipoDocumento: '', numeroDocumento: '',
    observacao: '',
  });

  const [fornecedores, setFornecedores] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [listaLancamentos, setListaLancamentos] = useState([]);
   const [contasCorrentes, setContasCorrentes] = useState([]); 
  const [filteredLancamentos, setFilteredLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  
  
  const [searchFornecedor, setSearchFornecedor] = useState('');
  const [searchCategoria, setSearchCategoria] = useState('');
  const [showFornecedorDropdown, setShowFornecedorDropdown] = useState(false);
  const [showCategoriaDropdown, setShowCategoriaDropdown] = useState(false);

  // Estados dos filtros
  const [filters, setFilters] = useState({
    contaCorrente: '',
    fornecedor: '',
    categoria: '',
    dataInicio: '',
    dataFim: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const monthName = selectedMonth ? monthNames[selectedMonth - 1] : '';

  const formatDateBR = (dateString) => {
        if (!dateString) return '';
        
        // Se a data vier no formato ISO completo (com hora), extrair apenas a parte da data
        const dateOnly = dateString.split('T')[0];
        
        const [year, month, day] = dateOnly.split('-');
        return `${day}/${month}/${year}`;
        };


  const formatDateInput = (dateString) => {
    if (!dateString) return '';
    if (dateString.includes('/')) {
      const [day, month, year] = dateString.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dateString;
  };

  const formatCurrency = (value) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const calculateTotals = (lancamentos = filteredLancamentos) => {
    const total = lancamentos.reduce((acc, item) => acc + (parseFloat(item.valorCompra) || 0), 0);
    const totalParcelas = lancamentos.reduce((acc, item) => acc + (parseFloat(item.valorParcela) || 0), 0);
    return { total, totalParcelas, count: lancamentos.length };
  };

  // Função para aplicar filtros
  const applyFilters = useCallback(() => {
    let filtered = [...listaLancamentos];

    // Filtro por conta corrente
    if (filters.contaCorrente) {
      filtered = filtered.filter(item => 
        item.contaCorrente && item.contaCorrente.toLowerCase().includes(filters.contaCorrente.toLowerCase())
      );
    }

    // Filtro por fornecedor
    if (filters.fornecedor) {
      filtered = filtered.filter(item => 
        item.fornecedor && item.fornecedor.toLowerCase().includes(filters.fornecedor.toLowerCase())
      );
    }

    // Filtro por categoria
    if (filters.categoria) {
      filtered = filtered.filter(item => 
        item.categoria && item.categoria.toLowerCase().includes(filters.categoria.toLowerCase())
      );
    }

    // Filtro por data de início
    if (filters.dataInicio) {
      filtered = filtered.filter(item => {
        if (!item.dataCompra) return false;
        const itemDate = new Date(item.dataCompra);
        const startDate = new Date(filters.dataInicio);
        return itemDate >= startDate;
      });
    }

    // Filtro por data de fim
    if (filters.dataFim) {
      filtered = filtered.filter(item => {
        if (!item.dataCompra) return false;
        const itemDate = new Date(item.dataCompra);
        const endDate = new Date(filters.dataFim);
        return itemDate <= endDate;
      });
    }

    setFilteredLancamentos(filtered);
    setSelectedItems([]); // Limpar seleção ao filtrar
  }, [listaLancamentos, filters]);

  // Aplicar filtros quando mudarem
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (selectedMonth && selectedYear) {
        document.title = `AZENHA - Lançamentos de ${monthName}/${selectedYear}`;
      }

      const [fornecedoresResponse, categoriasResponse, contasCorrentesResponse] = await Promise.all([
        axios.post(`${API_URL}/api/omie/fornecedores`),
        axios.post(`${API_URL}/api/omie/categorias`),
        axios.post(`${API_URL}/api/omie/contas-correntes`)
      ]);
      
      const filteredFornecedores = fornecedoresResponse.data.filter(cliente => 
        cliente.tags && cliente.tags.some(tag => tag.tag === 'Fornecedor')
      );
      setFornecedores(filteredFornecedores);
      
      const cleanedCategories = categoriasResponse.data.filter(c => 
        c.descricao && !c.descricao.toLowerCase().includes('disponível')
      );
      setCategorias(cleanedCategories);

      setContasCorrentes(contasCorrentesResponse.data);

      const lancamentosResponse = await axios.get(
        `${API_URL}/api/lancamentos?mes=${selectedMonth}&ano=${selectedYear}`
      );
      setListaLancamentos(lancamentosResponse.data);
    } catch (err) {
      setError("Não foi possível carregar os dados. Verifique a conexão com o back-end.");
      console.error("Erro ao buscar dados:", err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear, monthName]);

  useEffect(() => {
    if (selectedMonth && selectedYear) {
      fetchData();
    }
  }, [fetchData, selectedMonth, selectedYear]);

  const filteredFornecedoresList = fornecedores.filter(f => 
    f.razao_social.toLowerCase().includes(searchFornecedor.toLowerCase())
  );
  const filteredCategoriasList = categorias.filter(c => 
    c.descricao.toLowerCase().includes(searchCategoria.toLowerCase())
  );

  const handleSelectFornecedor = (fornecedor) => {
    setLancamento(prev => ({ ...prev, fornecedor }));
    setSearchFornecedor(fornecedor);
    setShowFornecedorDropdown(false);
  };

  const handleSelectCategoria = (categoria) => {
    setLancamento(prev => ({ ...prev, categoria }));
    setSearchCategoria(categoria);
    setShowCategoriaDropdown(false);
  };

  // Função para limpar filtros
  const clearFilters = () => {
    setFilters({
      contaCorrente: '',
      fornecedor: '',
      categoria: '',
      dataInicio: '',
      dataFim: ''
    });
  };

  // Função para contar filtros ativos
  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => value.trim() !== '').length;
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.dropdown-container')) {
        setShowFornecedorDropdown(false);
        setShowCategoriaDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLancamento(prevLancamento => ({ ...prevLancamento, [name]: value }));
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleLancar = async (e) => {
    e.preventDefault();
    const dataToSave = { ...lancamento };
    dataToSave.valorCompra = dataToSave.valorCompra === '' ? null : dataToSave.valorCompra;
    dataToSave.quantidadeParcelas = dataToSave.quantidadeParcelas === '' ? null : dataToSave.quantidadeParcelas;
    dataToSave.valorParcela = dataToSave.valorParcela === '' ? null : dataToSave.valorParcela;
    dataToSave.parcelaAtual = dataToSave.parcelaAtual === '' ? null : dataToSave.parcelaAtual;

    try {
      await axios.post(`${API_URL}/api/lancamentos`, dataToSave);
      console.log('Lançamento salvo com sucesso!');
      await fetchData(); 
      setLancamento({
        fornecedor: '', contaDesmembrada: 'nao', categoria: '', contaCorrente: '',
        dataCompra: '', valorCompra: '', quantidadeParcelas: '', valorParcela: '',
        parcelaAtual: '', dataVencimento: '', tipoDocumento: '', numeroDocumento: '',
        observacao: '',
      });
      setSearchFornecedor('');
      setSearchCategoria('');
      setShowForm(false);
    } catch (error) {
      console.error('Erro ao salvar o lançamento:', error.response?.data?.error || error.message);
      alert('Erro ao salvar o lançamento. Tente novamente.');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const dataToUpdate = { ...lancamento };
    try {
      await axios.put(`${API_URL}/api/lancamentos/${editingId}`, dataToUpdate);
      await fetchData(); 
      setEditingId(null);
      setLancamento({
        fornecedor: '', contaDesmembrada: 'nao', categoria: '', contaCorrente: '',
        dataCompra: '', valorCompra: '', quantidadeParcelas: '', valorParcela: '',
        parcelaAtual: '', dataVencimento: '', tipoDocumento: '', numeroDocumento: '',
        observacao: '',
      });
      setSearchFornecedor('');
      setSearchCategoria('');
      setShowForm(false);
    } catch (error) {
      console.error('Erro ao modificar lançamento:', error.response?.data?.error || error.message);
      alert('Erro ao modificar o lançamento. Tente novamente.');
    }
  };
  
  const handleCheckboxChange = (id) => {
    setSelectedItems(prevSelected =>
      prevSelected.includes(id)
        ? prevSelected.filter(item => item !== id)
        : [...prevSelected, id]
    );
  };

  const handleDelete = async () => {
    if (window.confirm(`Tem certeza que deseja excluir ${selectedItems.length} lançamento(s)?`)) {
      try {
        await axios.delete(`${API_URL}/api/lancamentos`, { data: { ids: selectedItems } });
        setListaLancamentos(listaLancamentos.filter(item => !selectedItems.includes(item.id)));
        setSelectedItems([]);
        console.log('Lançamentos excluídos com sucesso!');
      } catch (error) {
        console.error('Erro ao excluir lançamentos:', error.response?.data?.error || error.message);
        alert('Erro ao excluir lançamentos. Tente novamente.');
      }
    }
  };

  const handleEdit = () => {
    if (selectedItems.length === 1) {
      const itemToEdit = listaLancamentos.find(item => item.id === selectedItems[0]);
      setEditingId(itemToEdit.id);
      setLancamento({
        ...itemToEdit,
        dataCompra: formatDateInput(itemToEdit.dataCompra),
        dataVencimento: formatDateInput(itemToEdit.dataVencimento)
      });
      setSearchFornecedor(itemToEdit.fornecedor || '');
      setSearchCategoria(itemToEdit.categoria || '');
      setSelectedItems([]);
      setShowForm(true);
    }
  };

  const handleDownload = async () => {
    try {
      window.open(`${API_URL}/api/lancamentos/download`, '_blank');
      console.log('Download iniciado. Verifique o seu navegador.');
    } catch (error) {
      console.error('Erro ao iniciar o download:', error);
    }
  };

  const totals = calculateTotals();
  
  return (
    <div className="dashboard-container">
      <main className="main-container">
        <div className="dashboard-title-bar">
          <button onClick={onGoBack} className="back-button">
            ← Voltar
          </button>
          <div className="title-and-totals">
            <h2>Lançamentos de {monthName} de {selectedYear}</h2>
            <div className="totals-summary">
              <span className="total-item">Total: {formatCurrency(totals.total)}</span>
              <span className="total-item">Registros: {totals.count}</span>
            </div>
          </div>
          
          {/* PASSO 3: Adicionar o botão de Tema */}
          <button onClick={toggleTheme} className="theme-toggle-btn">
            {theme === 'light' ? '🌙 Modo Escuro' : '☀️ Modo Claro'}
          </button>
          
        </div>
        
        <div className="action-bar">
          <div className="action-group">
            <button 
              className="btn btn-primary"
              onClick={() => {
                setShowForm(!showForm);
                setEditingId(null);
                setLancamento({
                  fornecedor: '', contaDesmembrada: 'nao', categoria: '', contaCorrente: '',
                  dataCompra: '', valorCompra: '', quantidadeParcelas: '', valorParcela: '',
                  parcelaAtual: '', dataVencimento: '', tipoDocumento: '', numeroDocumento: '',
                  observacao: '',
                });
                setSearchFornecedor('');
                setSearchCategoria('');
              }}
            >
              <span className="btn-icon">+</span>
              <span className="btn-text">Novo</span>
            </button>

            <button 
              className={`btn btn-secondary ${getActiveFiltersCount() > 0 ? 'has-filters' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <span className="btn-icon">🔍</span>
              <span className="btn-text">Filtros</span>
              {getActiveFiltersCount() > 0 && (
                <span className="filter-badge">{getActiveFiltersCount()}</span>
              )}
            </button>
          </div>
          
          <div className="action-group">
            {selectedItems.length > 0 && (
              <>
                {selectedItems.length === 1 && (
                  <button className="btn btn-secondary" onClick={handleEdit}>
                    <span className="btn-icon">✏️</span>
                    <span className="btn-text-mobile">Editar</span>
                  </button>
                )}
                <button className="btn btn-danger" onClick={handleDelete}>
                  <span className="btn-icon">🗑️</span>
                  <span className="btn-text-mobile">Excluir ({selectedItems.length})</span>
                </button>
              </>
            )}
            <button className="btn btn-outline" onClick={handleDownload}>
              <span className="btn-icon">📥</span>
              <span className="btn-text-mobile">Excel</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Painel de Filtros */}
        {showFilters && (
          <div className="filter-panel">
            <div className="filter-header">
              <h3>Filtrar Lançamentos</h3>
              <button 
                className="close-btn"
                onClick={() => setShowFilters(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="filter-grid">
              <div className="filter-group">
                <label>Conta Corrente</label>
                <select 
                  name="contaCorrente" 
                  value={filters.contaCorrente} 
                  onChange={handleFilterChange}
                >
                  <option value="">Todas as contas</option>
                  {contasCorrentes.map(conta => (
                    <option key={conta.codigo} value={conta.descricao}>
                      {conta.descricao}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Fornecedor</label>
                <input
                  type="text"
                  name="fornecedor"
                  value={filters.fornecedor}
                  onChange={handleFilterChange}
                  placeholder="Digite o nome do fornecedor..."
                />
              </div>

              <div className="filter-group">
                <label>Categoria</label>
                <input
                  type="text"
                  name="categoria"
                  value={filters.categoria}
                  onChange={handleFilterChange}
                  placeholder="Digite o nome da categoria..."
                />
              </div>

              <div className="filter-group">
                <label>Data Início</label>
                <input
                  type="date"
                  name="dataInicio"
                  value={filters.dataInicio}
                  onChange={handleFilterChange}
                />
              </div>

              <div className="filter-group">
                <label>Data Fim</label>
                <input
                  type="date"
                  name="dataFim"
                  value={filters.dataFim}
                  onChange={handleFilterChange}
                />
              </div>

              <div className="filter-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={clearFilters}
                >
                  Limpar Filtros
                </button>
              </div>
            </div>
          </div>
        )}
        
        {showForm && (
          <div className="form-card">
            <div className="form-header">
              <h2>{editingId ? "Editar Lançamento" : "Novo Lançamento"}</h2>
              <button 
                className="close-btn"
                onClick={() => setShowForm(false)}
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={editingId ? handleUpdate : handleLancar} className="form-body">
              <div className="form-grid">
                <div className="form-group dropdown-container">
                  <label>Fornecedor *</label>
                  <input
                    type="text"
                    value={searchFornecedor}
                    onChange={(e) => {
                      setSearchFornecedor(e.target.value);
                      setLancamento(prev => ({ ...prev, fornecedor: e.target.value }));
                      setShowFornecedorDropdown(true);
                    }}
                    onFocus={() => setShowFornecedorDropdown(true)}
                    placeholder={loading ? "Carregando..." : "Digite para buscar fornecedor..."}
                    required
                    autoComplete="off"
                  />
                  {showFornecedorDropdown && !loading && (
                    <div className="dropdown-list">
                      {filteredFornecedoresList.length === 0 ? (
                        <div className="dropdown-item-empty">Nenhum fornecedor encontrado</div>
                      ) : (
                        <>
                          <div className="dropdown-header">
                            {filteredFornecedoresList.length} fornecedor(es) encontrado(s)
                          </div>
                          {filteredFornecedoresList.slice(0, 30).map(f => (
                            <div
                              key={f.codigo_cliente_omie}
                              className="dropdown-item"
                              onClick={() => handleSelectFornecedor(f.razao_social)}
                            >
                              {f.razao_social}
                            </div>
                          ))}
                          {filteredFornecedoresList.length > 30 && (
                            <div className="dropdown-footer">
                              Continue digitando para refinar a busca...
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group dropdown-container">
                  <label>Categoria *</label>
                  <input
                    type="text"
                    value={searchCategoria}
                    onChange={(e) => {
                      setSearchCategoria(e.target.value);
                      setLancamento(prev => ({ ...prev, categoria: e.target.value }));
                      setShowCategoriaDropdown(true);
                    }}
                    onFocus={() => setShowCategoriaDropdown(true)}
                    placeholder={loading ? "Carregando..." : "Digite para buscar categoria..."}
                    required
                    autoComplete="off"
                  />
                  {showCategoriaDropdown && !loading && (
                    <div className="dropdown-list">
                      {filteredCategoriasList.length === 0 ? (
                        <div className="dropdown-item-empty">Nenhuma categoria encontrada</div>
                      ) : (
                        <>
                          <div className="dropdown-header">
                            {filteredCategoriasList.length} categoria(s) encontrada(s)
                          </div>
                          {filteredCategoriasList.slice(0, 30).map(c => (
                            <div
                              key={c.codigo}
                              className="dropdown-item"
                              onClick={() => handleSelectCategoria(c.descricao)}
                            >
                              {c.descricao}
                            </div>
                          ))}
                          {filteredCategoriasList.length > 30 && (
                            <div className="dropdown-footer">
                              Continue digitando para refinar a busca...
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Conta Corrente *</label>
                  <select name="contaCorrente" value={lancamento.contaCorrente} onChange={handleChange} required>
                    <option value="">Selecione...</option>
                  {contasCorrentes.map(conta => (
                    <option key={conta.codigo} value={conta.descricao}>
                      {conta.descricao}
                    </option>
                  ))}
                  </select>

                </div>
                <div className="form-group">
                  <label>Data da Compra *</label>
                  <input type="date" name="dataCompra" value={lancamento.dataCompra} onChange={handleChange} required />
                </div>

                <div className="form-group">
                  <label>Valor da Compra *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    name="valorCompra" 
                    value={lancamento.valorCompra} 
                    onChange={handleChange} 
                    placeholder="0.00"
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Conta Desmembrada</label>
                  <select name="contaDesmembrada" value={lancamento.contaDesmembrada} onChange={handleChange}>
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Quantidade de Parcelas</label>
                  <input type="number" name="quantidadeParcelas" value={lancamento.quantidadeParcelas} onChange={handleChange} />
                </div>

                <div className="form-group">
                  <label>Valor da Parcela</label>
                  <input 
                    type="number" 
                    step="0.01"
                    name="valorParcela" 
                    value={lancamento.valorParcela} 
                    onChange={handleChange} 
                    placeholder="0.00"
                  />
                </div>

                <div className="form-group">
                  <label>Parcela Atual</label>
                  <input type="number" name="parcelaAtual" value={lancamento.parcelaAtual} onChange={handleChange} />
                </div>

                <div className="form-group">
                  <label>Data de Vencimento</label>
                  <input type="date" name="dataVencimento" value={lancamento.dataVencimento} onChange={handleChange} />
                </div>

                <div className="form-group">
                  <label>Tipo de Documento</label>
                  <input type="text" name="tipoDocumento" value={lancamento.tipoDocumento} onChange={handleChange} />
                </div>

                <div className="form-group">
                  <label>Número do Documento</label>
                  <input type="text" name="numeroDocumento" value={lancamento.numeroDocumento} onChange={handleChange} />
                </div>

                <div className="form-group form-group-full">
                  <label>Observação</label>
                  <textarea name="observacao" value={lancamento.observacao} onChange={handleChange} rows="3"></textarea>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-cancel" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-save">
                  {editingId ? "Salvar Alterações" : "Adicionar Lançamento"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="table-card">
          <div className="table-header">
            <h2>Lançamentos Registrados</h2>
            <span className="table-count">{filteredLancamentos.length} registros</span>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Carregando dados...</p>
            </div>
          ) : (
            <>
              {filteredLancamentos.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📊</div>
                  <h3>
                    {listaLancamentos.length === 0 
                      ? "Nenhum lançamento registrado"
                      : "Nenhum lançamento encontrado com os filtros aplicados"
                    }
                  </h3>
                  <p>
                    {listaLancamentos.length === 0 
                      ? "Comece adicionando seu primeiro lançamento"
                      : "Tente ajustar os filtros para encontrar os lançamentos desejados"
                    }
                  </p>
                  {listaLancamentos.length > 0 && (
                    <button 
                      className="btn btn-secondary"
                      onClick={clearFilters}
                      style={{ marginTop: '1rem' }}
                    >
                      Limpar Filtros
                    </button>
                  )}
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>
                            {/* Checkbox para a coluna de seleção */}
                        </th> 
                        <th>Fornecedor</th>
                        <th>Categoria</th>
                        <th>Valor Total</th>
                        <th>Data Compra</th>
                        <th>Parcelas</th>
                        <th>Valor Parcela</th>
                        <th>Vencimento</th>
                        <th>Documento</th>
                        <th>Observação</th>
                        <th>Conta Corrente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLancamentos.map(item => (
                        <tr key={item.id} className={selectedItems.includes(item.id) ? 'selected' : ''}>
                          <td>
                            <input 
                              type="checkbox" 
                              checked={selectedItems.includes(item.id)} 
                              onChange={() => handleCheckboxChange(item.id)} 
                            />
                          </td>
                          <td className="td-primary">{item.fornecedor}</td>
                          <td>{item.categoria}</td>
                          <td className="td-currency">{formatCurrency(item.valorCompra)}</td>
                          <td>{formatDateBR(item.dataCompra)}</td>
                          <td className="td-center">
                            {item.quantidadeParcelas ? `${item.parcelaAtual || '1'}/${item.quantidadeParcelas}` : '-'}
                          </td>
                          <td className="td-currency">{item.valorParcela ? formatCurrency(item.valorParcela) : '-'}</td>
                          <td>{formatDateBR(item.dataVencimento)}</td>
                          <td>{item.tipoDocumento || '-'} {item.numeroDocumento || ''}</td>
                          <td className="td-obs">{item.observacao || '-'}</td>
                          <td>{item.contaCorrente || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;