import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './Dashboard.css';
import API_URL from './config/api';

function AdminDashboard({ selectedMonth, selectedYear, onGoBack, clienteInfo }) {
    const [listaLancamentos, setListaLancamentos] = useState([]);
    const [groupedLancamentos, setGroupedLancamentos] = useState({});
    const [filteredGroupedLancamentos, setFilteredGroupedLancamentos] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [fornecedores, setFornecedores] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [lancamentosSelecionados, setLancamentosSelecionados] = useState([]);
    const [contasCorrentes, setContasCorrentes] = useState([]); // Lista de contas de crédito da Omie
    const [editingLancamento, setEditingLancamento] = useState(null);
    const [showEditForm, setShowEditForm] = useState(false);
    const [searchEditFornecedor, setSearchEditFornecedor] = useState('');
    const [searchEditCategoria, setSearchEditCategoria] = useState('');
    const [showEditFornecedorDropdown, setShowEditFornecedorDropdown] = useState(false);
    const [showEditCategoriaDropdown, setShowEditCategoriaDropdown] = useState(false);

    const [showReport, setShowReport] = useState(false);
    const [selectedAccountData, setSelectedAccountData] = useState(null);
    const [launchingToOmie, setLaunchingToOmie] = useState(false);
    
    const [filters, setFilters] = useState({
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

    const formatCurrency = (value) => {
        if (!value) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatDateBR = (dateString) => {
        if (!dateString) return '';
        
        // Se a data vier no formato ISO completo (com hora), extrair apenas a parte da data
        const dateOnly = dateString.split('T')[0];
        
        const [year, month, day] = dateOnly.split('-');
        return `${day}/${month}/${year}`;
        };

    const formatDateForOmie = (dateString) => {
    if (!dateString) return '';
    
    // 1. Limpa a string de data (remove a parte T e Z)
    const dateOnly = dateString.split('T')[0]; // Pega YYYY-MM-DD
    
    // 2. Extrai e reordena as partes
    const parts = dateOnly.split('-');
    
    if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1];
        const day = parts[2];
        
        // Formato final OMIE: DD/MM/AAAA (10 caracteres)
        return `${day}/${month}/${year}`; 
    }
    
    // Se não for um formato válido, retorna a string original ou vazio
    return ''; 
};

    const applyFilters = useCallback(() => {
        const filteredGroups = {};
        Object.entries(groupedLancamentos).forEach(([conta, lancamentos]) => {
            let filtered = [...lancamentos];
            if (filters.fornecedor) {
                filtered = filtered.filter(item =>
                    item.fornecedor && item.fornecedor.toLowerCase().includes(filters.fornecedor.toLowerCase())
                );
            }
            if (filters.categoria) {
                filtered = filtered.filter(item =>
                    item.categoria && item.categoria.toLowerCase().includes(filters.categoria.toLowerCase())
                );
            }
            if (filters.dataInicio) {
                filtered = filtered.filter(item => {
                    if (!item.dataCompra) return false;
                    const itemDate = new Date(item.dataCompra);
                    const startDate = new Date(filters.dataInicio);
                    return itemDate >= startDate;
                });
            }
            if (filters.dataFim) {
                filtered = filtered.filter(item => {
                    if (!item.dataCompra) return false;
                    const itemDate = new Date(item.dataCompra);
                    const endDate = new Date(filters.dataFim);
                    return itemDate <= endDate;
                });
            }
            if (filtered.length > 0) {
                filteredGroups[conta] = filtered;
            }
        });
        setFilteredGroupedLancamentos(filteredGroups);
    }, [groupedLancamentos, filters]);

    useEffect(() => {
        applyFilters();
    }, [applyFilters]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const config = {
                headers: { Authorization: `Bearer ${token}` }
            };

            const lancamentosResponse = await axios.get(
                `${API_URL}/api/admin/lancamentos?mes=${selectedMonth}&ano=${selectedYear}&clienteId=${clienteInfo.id}`,
                config
            );
            
            setListaLancamentos(lancamentosResponse.data);
            const grouped = lancamentosResponse.data.reduce((acc, current) => {
                const conta = current.contaCorrente || 'Outras';
                if (!acc[conta]) {
                    acc[conta] = [];
                }
                acc[conta].push(current);
                return acc;
            }, {});
            setGroupedLancamentos(grouped);
        } catch (err) {
            setError('Não foi possível carregar os lançamentos. Verifique a conexão com o back-end.');
            console.error('Erro ao buscar dados:', err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, selectedYear, clienteInfo.id]);

    const fetchOmieData = useCallback(async () => {
    try {
        const token = localStorage.getItem('token');
        const config = {
            headers: { Authorization: `Bearer ${token}` }
        };

        // Adicionando a chamada para contas correntes
        const [fornecedoresRes, categoriasRes, contasCorrentesRes] = await Promise.all([
            axios.post(`${API_URL}/api/admin/omie/fornecedores`, 
                { clienteId: clienteInfo.id }, 
                config
            ),
            axios.post(`${API_URL}/api/admin/omie/categorias`, 
                { clienteId: clienteInfo.id }, 
                config
            ),
            // NOVA CHAMADA DE API PARA O ADMIN
            axios.post(`${API_URL}/api/admin/omie/contas-correntes`, 
                { clienteId: clienteInfo.id }, 
                config
            )
        ]);
        
        setFornecedores(fornecedoresRes.data || []);
        const categoriasValidas = (categoriasRes.data || []).filter(c => 
            c.descricao && !c.descricao.toLowerCase().includes('disponível')
        );
        setCategorias(categoriasValidas);
        
        // SALVA AS CONTAS CORRENTES
        setContasCorrentes(contasCorrentesRes.data || []); 
    } catch (err) {
        console.error('Erro ao buscar dados da Omie:', err.message);
        // É importante NÃO setar o erro aqui, ou ele sobreescreverá o erro de carregamento de lançamentos.
    }
}, [clienteInfo.id]);

    useEffect(() => {
        if (selectedMonth && selectedYear && clienteInfo) {
            fetchData();
            fetchOmieData();
        }
    }, [fetchData, fetchOmieData, selectedMonth, selectedYear, clienteInfo]);

    const clearFilters = () => {
        setFilters({
            fornecedor: '',
            categoria: '',
            dataInicio: '',
            dataFim: ''
        });
    };

    const getActiveFiltersCount = () => {
        return Object.values(filters).filter(value => value.trim() !== '').length;
    };

    const calculateGeneralTotals = () => {
        const allFilteredLancamentos = Object.values(filteredGroupedLancamentos).flat();
        const total = allFilteredLancamentos.reduce((acc, item) => acc + (parseFloat(item.valorCompra) || 0), 0);
        return {
            total,
            count: allFilteredLancamentos.length,
            accounts: Object.keys(filteredGroupedLancamentos).length
        };
    };

    const calculateAccountTotals = (lancamentos) => {
        const total = lancamentos.reduce((acc, item) => acc + (parseFloat(item.valorCompra) || 0), 0);
        return { total, count: lancamentos.length };
    };

    const totals = calculateGeneralTotals();

    const filteredEditFornecedores = fornecedores.filter(f =>
        f.razao_social && f.razao_social.toLowerCase().includes(searchEditFornecedor.toLowerCase())
    );
    
    const filteredEditCategorias = categorias.filter(c =>
        c.descricao && c.descricao.toLowerCase().includes(searchEditCategoria.toLowerCase())
    );

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerateReport = (conta) => {
        const data = filteredGroupedLancamentos[conta];
        setSelectedAccountData({ conta, lancamentos: data });
        setShowReport(true);
    };

    const handleEditLancamento = (lancamentoToEdit) => {
        setEditingLancamento({ ...lancamentoToEdit });
        setSearchEditFornecedor(lancamentoToEdit.fornecedor || '');
        setSearchEditCategoria(lancamentoToEdit.categoria || '');
        setShowEditForm(true);
        setShowReport(false);
    };

    const handleUpdateChange = (e) => {
        const { name, value } = e.target;
        setEditingLancamento(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectEditFornecedor = (fornecedor) => {
        setEditingLancamento(prev => ({
            ...prev,
            fornecedor: fornecedor.razao_social,
            codigo_cliente_fornecedor: fornecedor.codigo_cliente_omie
        }));
        setSearchEditFornecedor(fornecedor.razao_social);
        setShowEditFornecedorDropdown(false);
    };

    const handleSelectEditCategoria = (categoria) => {
        setEditingLancamento(prev => ({
            ...prev,
            categoria: categoria.descricao,
            cod_categoria: categoria.codigo
        }));
        setSearchEditCategoria(categoria.descricao);
        setShowEditCategoriaDropdown(false);
    };

    const handleUpdateSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const config = {
                headers: { Authorization: `Bearer ${token}` }
            };

            const dataToUpdate = {
                fornecedor: editingLancamento.fornecedor,
                categoria: editingLancamento.categoria,
                contaCorrente: editingLancamento.contaCorrente,
                dataCompra: editingLancamento.dataCompra,
                dataVencimento: editingLancamento.dataVencimento || editingLancamento.dataCompra,
                valorCompra: parseFloat(editingLancamento.valorCompra),
                observacao: editingLancamento.observacao || ''
            };
                
            await axios.put(`${API_URL}/api/admin/lancamentos/${editingLancamento.id}`, 
                dataToUpdate, 
                config
            );
            
            alert('Lançamento atualizado com sucesso!');
            setShowEditForm(false);
            setEditingLancamento(null);
            fetchData();
        } catch (error) {
            console.error('Erro ao atualizar o lançamento:', error.response?.data?.error || error.message);
            alert('Erro ao atualizar o lançamento.');
        }
    };
    
    const handleDeleteLancamento = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir este lançamento?')) {
            try {
                const token = localStorage.getItem('token');
                const config = {
                    headers: { Authorization: `Bearer ${token}` }
                };

                await axios.delete(`${API_URL}/api/admin/lancamentos/${id}`, config);
                alert('Lançamento excluído com sucesso!');
                fetchData();
            } catch (error) {
                console.error('Erro ao excluir o lançamento:', error);
                alert('Erro ao excluir o lançamento.');
            }
        }
    };
    
    const handleBulkDelete = async () => {
        if (lancamentosSelecionados.length === 0) {
            alert('Selecione pelo menos um lançamento para excluir.');
            return;
        }

        if (window.confirm(`Tem certeza que deseja excluir ${lancamentosSelecionados.length} lançamentos?`)) {
            try {
                const token = localStorage.getItem('token');
                const config = {
                    headers: { Authorization: `Bearer ${token}` }
                };

                // Deletar um por um já que não temos endpoint de bulk delete para admin
                for (const id of lancamentosSelecionados) {
                    await axios.delete(`${API_URL}/api/admin/lancamentos/${id}`, config);
                }
                
                alert(`${lancamentosSelecionados.length} lançamentos excluídos com sucesso!`);
                setLancamentosSelecionados([]);
                fetchData();
            } catch (error) {
                console.error('Erro ao excluir lançamentos em massa:', error);
                alert('Erro ao excluir lançamentos. Tente novamente.');
            }
        }
    };

    const handleSelectLancamento = (id) => {
        setLancamentosSelecionados(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleLaunchToOmie = async () => {
    if (!selectedAccountData) return;
    
    const confirmMessage = `Tem certeza que deseja lançar ${selectedAccountData.lancamentos.length} registros da conta "${selectedAccountData.conta}" na Omie?`;
    if (!window.confirm(confirmMessage)) return;
    
    setLaunchingToOmie(true);
    try {
        const token = localStorage.getItem('token');
        const config = {
            headers: { Authorization: `Bearer ${token}` }
        };

        // Buscar o código da conta corrente
        const contaOmie = contasCorrentes.find(c => c.descricao === selectedAccountData.conta);
        if (!contaOmie) {
            throw new Error(`Conta "${selectedAccountData.conta}" não encontrada na Omie`);
        }

        const lancamentosPreparados = [];
        const erros = [];

        for (const lanc of selectedAccountData.lancamentos) {
            // Buscar fornecedor
            const fornecedorOmie = fornecedores.find(f => 
                f.razao_social === lanc.fornecedor
            );
            
            if (!fornecedorOmie) {
                erros.push(`Fornecedor "${lanc.fornecedor}" não encontrado`);
                continue;
            }

            // Buscar categoria
            const categoriaOmie = categorias.find(c => 
                c.descricao === lanc.categoria
            );
            
            if (!categoriaOmie) {
                erros.push(`Categoria "${lanc.categoria}" não encontrada`);
                continue;
            }

                    lancamentosPreparados.push({
                    codigo_lancamento_integracao: `ADMIN_${lanc.id}_${Date.now()}`,
                    codigo_cliente_fornecedor: fornecedorOmie.codigo_cliente_omie,
                    id_conta_corrente: contaOmie.codigo,
                    
                    // 🟢 CORREÇÃO DA DATA: Usa a nova formatDateForOmie()
                    data_vencimento: formatDateForOmie(lanc.dataVencimento || lanc.dataCompra),
                    data_emissao: formatDateForOmie(lanc.dataCompra), 
                    
                    // 🟢 CORREÇÃO DA PROPRIEDADE: Usar nomes em camelCase vindos do DB via Node.js
                    valor_documento: parseFloat(lanc.valorCompra || 0),
                    codigo_categoria: categoriaOmie.codigo,
                    observacao: lanc.observacao || '',
                    numero_documento: lanc.numeroDocumento || ''
                });
            }
        if (erros.length > 0) {
            const continuar = window.confirm(
                `Foram encontrados ${erros.length} erros:\n${erros.slice(0, 5).join('\n')}\n\nDeseja continuar com os ${lancamentosPreparados.length} lançamentos válidos?`
            );
            if (!continuar) {
                setLaunchingToOmie(false);
                return;
            }
        }

        if (lancamentosPreparados.length === 0) {
            throw new Error('Nenhum lançamento válido para enviar');
        }

        await axios.post(`${API_URL}/api/admin/omie/lancamentos-lote`, 
            {
                lancamentos: lancamentosPreparados,
                clienteId: clienteInfo.id
            },
            config
        );
        
        alert(`✅ Sucesso! ${lancamentosPreparados.length} lançamentos enviados para a Omie.`);
        setShowReport(false);
        setSelectedAccountData(null);
    } catch (error) {
        console.error('Erro ao lançar para Omie:', error);
        const errorMessage = error.response?.data?.error || error.message || 'Erro desconhecido';
        alert(`❌ Erro ao lançar para Omie:\n\n${errorMessage}`);
    } finally {
        setLaunchingToOmie(false);
    }
};
    
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.dropdown-container')) {
                setShowEditFornecedorDropdown(false);
                setShowEditCategoriaDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <main className="main-container">
            <div className="dashboard-title-bar">
                <button onClick={onGoBack} className="back-button">
                    ← Voltar
                </button>
                <div className="title-and-totals">
                    <h2>Lançamentos de {monthName}/{selectedYear} - {clienteInfo.nome} (Admin)</h2>
                    <div className="totals-summary">
                        <span className="total-item">Total: {formatCurrency(totals.total)}</span>
                        <span className="total-item">Registros: {totals.count}</span>
                        <span className="total-item">Contas: {totals.accounts}</span>
                    </div>
                </div>
            </div>

            <div className="action-bar">
                <div className="action-group">
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            setShowFilters(!showFilters);
                            setShowReport(false);
                            setShowEditForm(false);
                        }}
                    >
                        <span className="btn-icon">🔍</span>
                        <span className="btn-text">Filtros</span>
                        {getActiveFiltersCount() > 0 && (
                            <span className="filter-badge">{getActiveFiltersCount()}</span>
                        )}
                    </button>
                </div>
                {listaLancamentos.length > 0 && (
                    <button className="btn btn-delete-bulk" onClick={handleBulkDelete}>
                        🗑️ Excluir Selecionados ({lancamentosSelecionados.length})
                    </button>
                )}
            </div>

            {error && (
                <div className="alert alert-error">
                    <span>⚠️ {error}</span>
                </div>
            )}

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

            {showEditForm && editingLancamento && (
                <div className="form-card">
                    <div className="form-header">
                        <h2>Editar Lançamento</h2>
                        <button className="close-btn" onClick={() => {
                            setShowEditForm(false);
                            setEditingLancamento(null);
                        }}>
                            ✕
                        </button>
                    </div>
                    <form onSubmit={handleUpdateSubmit} className="form-body">
                        <div className="form-grid">
                            <div className="form-group dropdown-container">
                                <label>Fornecedor *</label>
                                <input
                                    type="text"
                                    value={searchEditFornecedor}
                                    onChange={(e) => {
                                        setSearchEditFornecedor(e.target.value);
                                        setShowEditFornecedorDropdown(true);
                                        setEditingLancamento(prev => ({ ...prev, fornecedor: e.target.value }));
                                    }}
                                    onFocus={() => setShowEditFornecedorDropdown(true)}
                                    placeholder="Digite para buscar fornecedor..."
                                    required
                                    autoComplete="off"
                                />
                                {showEditFornecedorDropdown && filteredEditFornecedores.length > 0 && (
                                    <div className="dropdown-list">
                                        {filteredEditFornecedores.slice(0, 20).map(f => (
                                            <div
                                                key={f.codigo_cliente_omie}
                                                className="dropdown-item"
                                                onClick={() => handleSelectEditFornecedor(f)}
                                            >
                                                {f.razao_social}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="form-group dropdown-container">
                                <label>Categoria *</label>
                                <input
                                    type="text"
                                    value={searchEditCategoria}
                                    onChange={(e) => {
                                        setSearchEditCategoria(e.target.value);
                                        setShowEditCategoriaDropdown(true);
                                        setEditingLancamento(prev => ({ ...prev, categoria: e.target.value }));
                                    }}
                                    onFocus={() => setShowEditCategoriaDropdown(true)}
                                    placeholder="Digite para buscar categoria..."
                                    required
                                    autoComplete="off"
                                />
                                {showEditCategoriaDropdown && filteredEditCategorias.length > 0 && (
                                    <div className="dropdown-list">
                                        {filteredEditCategorias.map(c => (
                                            <div
                                                key={c.codigo}
                                                className="dropdown-item"
                                                onClick={() => handleSelectEditCategoria(c)}
                                            >
                                                {c.descricao}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <label>Conta Corrente *</label>
                                <select 
                                    name="contaCorrente" 
                                    value={editingLancamento.contaCorrente} 
                                    onChange={handleUpdateChange} 
                                    required
                                >
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
                                <input 
                                    type="date" 
                                    name="dataCompra" 
                                    value={editingLancamento.dataCompra} 
                                    onChange={handleUpdateChange} 
                                    required 
                                />
                            </div>
                            <div className="form-group">
                                <label>Data de Vencimento</label>
                                <input 
                                    type="date" 
                                    name="dataVencimento" 
                                    value={editingLancamento.dataVencimento || ''} 
                                    onChange={handleUpdateChange} 
                                />
                            </div>
                            <div className="form-group">
                                <label>Valor da Compra *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="valorCompra"
                                    value={editingLancamento.valorCompra}
                                    onChange={handleUpdateChange}
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                            <div className="form-group form-group-full">
                                <label>Observação</label>
                                <textarea 
                                    name="observacao" 
                                    value={editingLancamento.observacao || ''} 
                                    onChange={handleUpdateChange} 
                                    rows="3"
                                ></textarea>
                            </div>
                        </div>
                        <div className="form-actions">
                            <button type="button" className="btn btn-cancel" onClick={() => {
                                setShowEditForm(false);
                                setEditingLancamento(null);
                            }}>
                                Cancelar
                            </button>
                            <button type="submit" className="btn btn-save">
                                Salvar Alterações
                            </button>
                        </div>
                    </form>
                </div>
            )}
            
            {!showFilters && !showReport && !showEditForm && (
                <>
                    {loading && (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>Carregando dados...</p>
                        </div>
                    )}
                    
                    {!loading && Object.keys(filteredGroupedLancamentos).length === 0 && (
                        <div className="empty-state">
                            <div className="empty-icon">📊</div>
                            <h3>
                                {Object.keys(groupedLancamentos).length === 0
                                    ? `Nenhum lançamento registrado para ${clienteInfo.nome} em ${monthName}/${selectedYear}`
                                    : "Nenhum lançamento encontrado com os filtros aplicados"
                                }
                            </h3>
                            <p>
                                {Object.keys(groupedLancamentos).length === 0
                                    ? `Nenhum lançamento foi encontrado para este cliente no período selecionado.`
                                    : "Tente ajustar os filtros para encontrar os lançamentos desejados"
                                }
                            </p>
                            {Object.keys(groupedLancamentos).length > 0 && (
                                <button
                                    className="btn btn-secondary"
                                    onClick={clearFilters}
                                    style={{ marginTop: '1rem' }}
                                >
                                    Limpar Filtros
                                </button>
                            )}
                        </div>
                    )}

                    {!loading && Object.keys(filteredGroupedLancamentos).length > 0 && (
                        <>
                            {Object.entries(filteredGroupedLancamentos).map(([conta, lancamentos]) => {
                                const accountTotals = calculateAccountTotals(lancamentos);

                                return (
                                    <div key={conta} className="table-card" style={{ marginBottom: '2rem' }}>
                                        <div className="table-header">
                                            <div className="account-info">
                                                <h2>Conta Corrente: {conta}</h2>
                                                <div className="account-totals">
                                                    <span className="total-item">Total: {formatCurrency(accountTotals.total)}</span>
                                                    <span className="total-item">Registros: {accountTotals.count}</span>
                                                </div>
                                            </div>
                                            <div className="action-group">
                                                <button 
                                                    className="btn btn-primary" 
                                                    onClick={() => handleGenerateReport(conta)}
                                                >
                                                    <span className="btn-icon">📊</span>
                                                    <span className="btn-text-mobile">Gerar Relatório</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="table-wrapper">
                                            <table className="data-table">
                                                <thead>
                                                    <tr>
                                                        <th><input type="checkbox" onChange={() => {}} /></th>
                                                        <th>Fornecedor</th>
                                                        <th>Categoria</th>
                                                        <th>Valor</th>
                                                        <th>Data Compra</th>
                                                        <th>Vencimento</th>
                                                        <th>Observação</th>
                                                        <th>Ações</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {lancamentos.slice(0, 5).map(item => (
                                                        <tr key={item.id}>
                                                            <td>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={lancamentosSelecionados.includes(item.id)}
                                                                    onChange={() => handleSelectLancamento(item.id)}
                                                                />
                                                            </td>
                                                            <td className="td-primary">{item.fornecedor}</td>
                                                            <td>{item.categoria}</td>
                                                            <td className="td-currency">{formatCurrency(item.valorCompra)}</td>
                                                            <td>{formatDateBR(item.dataCompra)}</td>
                                                            <td>{formatDateBR(item.dataVencimento)}</td>
                                                            <td className="td-obs">{item.observacao || '-'}</td>
                                                            <td className="td-actions">
                                                                <button 
                                                                    className="btn-icon btn-edit" 
                                                                    onClick={() => handleEditLancamento(item)}
                                                                    title="Editar"
                                                                >
                                                                    ✏️
                                                                </button>
                                                                <button
                                                                    className="btn-icon btn-delete"
                                                                    onClick={() => handleDeleteLancamento(item.id)}
                                                                    title="Excluir"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {lancamentos.length > 5 && (
                                                        <tr>
                                                            <td colSpan="8" className="text-center">
                                                                <em>... e mais {lancamentos.length - 5} lançamentos. Clique em "Gerar Relatório" para ver todos.</em>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </>
            )}

            {showReport && selectedAccountData && (
                <div className="report-card">
                    <div className="report-header">
                        <h2>Relatório de Lançamentos - {selectedAccountData.conta}</h2>
                        <div className="report-actions">
                            <button
                                className={`btn btn-save ${launchingToOmie ? 'disabled' : ''}`}
                                onClick={handleLaunchToOmie}
                                disabled={launchingToOmie}
                            >
                                {launchingToOmie ? (
                                    <>
                                        <span className="spinner-small"></span>
                                        Enviando para Omie...
                                    </>
                                ) : (
                                    <>
                                        <span className="btn-icon">🚀</span>
                                        Lançar na Omie
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    
                    <div className="report-summary">
                        <div className="summary-item">
                            <strong>Total Geral:</strong> {formatCurrency(calculateAccountTotals(selectedAccountData.lancamentos).total)}
                        </div>
                        <div className="summary-item">
                            <strong>Quantidade:</strong> {selectedAccountData.lancamentos.length} lançamentos
                        </div>
                    </div>

                    <div className="table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Fornecedor</th>
                                    <th>Categoria</th>
                                    <th>Valor</th>
                                    <th>Data Compra</th>
                                    <th>Vencimento</th>
                                    <th>Observação</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedAccountData.lancamentos.map(item => (
                                    <tr key={item.id}>
                                        <td className="td-primary">{item.fornecedor}</td>
                                        <td>{item.categoria}</td>
                                        <td className="td-currency">{formatCurrency(item.valorCompra)}</td>
                                        <td>{formatDateBR(item.dataCompra)}</td>
                                        <td>{formatDateBR(item.dataVencimento)}</td>
                                        <td className="td-obs">{item.observacao || '-'}</td>
                                        <td className="td-actions">
                                            <button 
                                                className="btn-icon btn-edit" 
                                                onClick={() => handleEditLancamento(item)}
                                                title="Editar"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="btn-icon btn-delete"
                                                onClick={() => handleDeleteLancamento(item.id)}
                                                title="Excluir"
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    <div className="report-footer">
                        <button className="btn btn-cancel" onClick={() => setShowReport(false)}>
                            ← Voltar ao Dashboard
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}

export default AdminDashboard;