require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const exceljs = require('exceljs');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');


const port = process.env.PORT || 3001; 

const upload = multer({ dest: 'uploads/' });

const app = express();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false
});
// Configuração do PostgreSQL


// Testar conexão com o banco
pool.connect((err, client, release) => {
  if (err) {
    console.error('Erro ao conectar ao PostgreSQL:', err.stack);
  } else {
    console.log('Conectado ao PostgreSQL com sucesso!');
    release();
  }
});

// Configuração JWT
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_super_segura';

app.use(express.json());
app.use(cors());

// Função para gerar token JWT
const generateToken = (userId, email, isAdmin = false) => {
  return jwt.sign(
    { userId, email, isAdmin },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Middleware de autenticação para clientes
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.isAdmin) {
      return res.status(403).json({ error: 'Acesso negado. Use rota de admin.' });
    }
    
    const result = await pool.query(
      'SELECT * FROM clientes WHERE email = $1 AND ativo = true',
      [decoded.email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Cliente não encontrado' });
    }
    
    req.user = { id: decoded.userId, email: decoded.email };
    req.cliente = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Middleware de autenticação para admin
const adminAuthMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (!decoded.isAdmin) {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }
    
    req.user = { id: decoded.userId, email: decoded.email };
    req.isAdmin = true;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};



// --- Endpoint de Login para Clientes ---
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // Buscar usuário na tabela usuarios
    const userResult = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }
    
    const user = userResult.rows[0];
    
    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, user.senha);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }
    
    // Buscar dados do cliente
    const clienteResult = await pool.query(
      'SELECT * FROM clientes WHERE email = $1 AND ativo = true',
      [email]
    );
    
    if (clienteResult.rows.length === 0) {
      return res.status(401).json({ error: 'Cliente não encontrado ou inativo' });
    }
    
    const cliente = clienteResult.rows[0];
    const token = generateToken(user.id, email, false);
    
    res.status(200).json({
      access_token: token,
      refresh_token: token, // Simplificado - você pode implementar refresh token separado
      user: {
        id: user.id,
        email: user.email
      },
      cliente: {
        id: cliente.id,
        nome: cliente.nome,
        email: cliente.email,
        omie_app_key: cliente.omie_app_key,
        omie_app_secret: cliente.omie_app_secret
      },
      isCliente: true
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro ao tentar fazer login.' });
  }
});

// --- Endpoint de Login para Admin ---
app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // Buscar admin na tabela admins
    const adminResult = await pool.query(
      'SELECT * FROM admins WHERE email = $1 AND ativo = true',
      [email]
    );
    
    if (adminResult.rows.length === 0) {
      return res.status(403).json({ error: 'Acesso negado. Credenciais de admin inválidas.' });
    }
    
    const admin = adminResult.rows[0];
    
    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, admin.senha);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }
    
    const token = generateToken(admin.id, email, true);
    
    res.status(200).json({
      access_token: token,
      refresh_token: token,
      user: {
        id: admin.id,
        email: admin.email,
        nome: admin.nome
      },
      isAdmin: true
    });
  } catch (err) {
    console.error('Erro no login admin:', err);
    res.status(500).json({ error: 'Erro ao tentar fazer login como administrador.' });
  }
});

// --- Endpoint para criar usuário (temporário - para setup inicial) ---
app.post('/api/setup/create-user', async (req, res) => {
  const { email, password, isAdmin, nome } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    if (isAdmin) {
      // Criar admin
      const result = await pool.query(
        'INSERT INTO admins (email, senha, nome, ativo) VALUES ($1, $2, $3, true) RETURNING id, email, nome',
        [email, hashedPassword, nome]
      );
      res.json({ message: 'Admin criado com sucesso', admin: result.rows[0] });
    } else {
      // Criar usuário regular
      const userResult = await pool.query(
        'INSERT INTO usuarios (email, senha) VALUES ($1, $2) RETURNING id, email',
        [email, hashedPassword]
      );
      
      // Criar cliente correspondente
      const clienteResult = await pool.query(
        'INSERT INTO clientes (nome, email, ativo) VALUES ($1, $2, true) RETURNING *',
        [nome, email]
      );
      
      res.json({ 
        message: 'Usuário e cliente criados com sucesso', 
        user: userResult.rows[0],
        cliente: clienteResult.rows[0]
      });
    }
  } catch (err) {
    console.error('Erro ao criar usuário:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Endpoint para buscar lista de clientes (Admin) ---
app.get('/api/admin/clients', adminAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nome, email FROM clientes WHERE ativo = true ORDER BY nome'
    );
    
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar clientes:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// --- Endpoint para buscar dados do cliente atual ---
app.get('/api/cliente/info', authMiddleware, async (req, res) => {
  try {
    res.status(200).json({
      cliente: {
        id: req.cliente.id,
        nome: req.cliente.nome,
        email: req.cliente.email
      }
    });
  } catch (err) {
    console.error('Erro ao buscar informações do cliente:', err);
    res.status(500).json({ error: 'Erro ao buscar informações do cliente.' });
  }
});



// --- Endpoint para Salvar Lançamentos (Cliente) ---
app.post('/api/lancamentos', authMiddleware, async (req, res) => {
  const lancamento = req.body;
  
  // Se não houver dataVencimento, use a dataCompra
  if (!lancamento.dataVencimento) {
    lancamento.dataVencimento = lancamento.dataCompra;
  }
  
  try {
    const query = `
      INSERT INTO lancamentos (
        cliente_id, fornecedor, contadesmembrada, categoria, 
        contacorrente, datacompra, valorcompra, quantidadeparcelas,
        valorparcela, parcelaatual, datavencimento, tipodocumento,
        numerodocumento, observacao
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING 
        id,
        fornecedor,
        contadesmembrada AS "contaDesmembrada",
        categoria,
        contacorrente AS "contaCorrente",
        datacompra AS "dataCompra",
        valorcompra AS "valorCompra",
        quantidadeparcelas AS "quantidadeParcelas",
        valorparcela AS "valorParcela",
        parcelaatual AS "parcelaAtual",
        datavencimento AS "dataVencimento",
        tipodocumento AS "tipoDocumento",
        numerodocumento AS "numeroDocumento",
        observacao
    `;
    
    const values = [
      req.cliente.id,
      lancamento.fornecedor,
      lancamento.contaDesmembrada || 'nao',
      lancamento.categoria,
      lancamento.contaCorrente,
      lancamento.dataCompra,
      lancamento.valorCompra,
      lancamento.quantidadeParcelas || null,
      lancamento.valorParcela || null,
      lancamento.parcelaAtual || null,
      lancamento.dataVencimento,
      lancamento.tipoDocumento || null,
      lancamento.numeroDocumento || null,
      lancamento.observacao || null
    ];
    
    const result = await pool.query(query, values);
    res.status(201).json({ 
      message: 'Lançamento salvo com sucesso!', 
      data: result.rows[0] 
    });
  } catch (err) {
    console.error('Erro ao salvar lançamento:', err);
    res.status(500).json({ error: 'Erro ao salvar o lançamento.' });
  }
});

// --- Endpoint para buscar lançamentos de um cliente específico (Admin) ---
app.get('/api/admin/lancamentos', adminAuthMiddleware, async (req, res) => {
  try {
    const { mes, ano, clienteId } = req.query;

    // 🔍 LOG 1: Ver o que está chegando
    console.log('📥 Parâmetros recebidos:', { mes, ano, clienteId });

    if (!mes || !ano || !clienteId) {
      console.log('❌ Parâmetros faltando!');
      return res.status(400).json({ error: 'Parâmetros de mês, ano e clienteId são obrigatórios.' });
    }

    const month = parseInt(mes, 10);
    const year = parseInt(ano, 10);

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

    // 🔍 LOG 2: Ver as datas calculadas
    console.log('📅 Período:', { startDate, endDate });

    const query = `
      SELECT 
        id,
        cliente_id,
        fornecedor,
        contadesmembrada AS "contaDesmembrada",
        categoria,
        contacorrente AS "contaCorrente",
        datacompra AS "dataCompra",
        valorcompra AS "valorCompra",
        quantidadeparcelas AS "quantidadeParcelas",
        valorparcela AS "valorParcela",
        parcelaatual AS "parcelaAtual",
        datavencimento AS "dataVencimento",
        tipodocumento AS "tipoDocumento",
        numerodocumento AS "numeroDocumento",
        observacao
      FROM lancamentos 
      WHERE cliente_id = $1 
      AND datacompra >= $2 
      AND datacompra <= $3
      ORDER BY datacompra ASC
    `;
    
    // 🔍 LOG 3: Ver a query que será executada
    console.log('🔍 Query params:', [clienteId, startDate, endDate]);
    
    const result = await pool.query(query, [clienteId, startDate, endDate]);
    
    // 🔍 LOG 4: Ver quantos registros foram encontrados
    console.log(`✅ Encontrados ${result.rows.length} lançamentos`);
    
    res.status(200).json(result.rows);
  } catch (err) {
    // 🔍 LOG 5: Ver o erro completo
    console.error('❌ ERRO COMPLETO ao buscar lançamentos:', err);
    console.error('Stack trace:', err.stack);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// --- Endpoint para atualizar lançamento (Cliente) ---
// --- Endpoint para atualizar lançamento (Admin) ---
app.put('/api/admin/lancamentos/:id', adminAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  const lancamento = req.body;

  try {
    const query = `
      UPDATE lancamentos SET
        fornecedor = $2,
        categoria = $3,
        contacorrente = $4,
        datacompra = $5,
        datavencimento = $6,
        valorcompra = $7,
        observacao = $8
      WHERE id = $1
      RETURNING 
        id,
        fornecedor,
        contadesmembrada AS "contaDesmembrada",
        categoria,
        contacorrente AS "contaCorrente",
        datacompra AS "dataCompra",
        valorcompra AS "valorCompra",
        quantidadeparcelas AS "quantidadeParcelas",
        valorparcela AS "valorParcela",
        parcelaatual AS "parcelaAtual",
        datavencimento AS "dataVencimento",
        tipodocumento AS "tipoDocumento",
        numerodocumento AS "numeroDocumento",
        observacao
    `;
    
    const values = [
      id,
      lancamento.fornecedor,
      lancamento.categoria,
      lancamento.contaCorrente,
      lancamento.dataCompra,
      lancamento.dataVencimento || lancamento.dataCompra,
      lancamento.valorCompra,
      lancamento.observacao || null
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lançamento não encontrado.' });
    }

    res.status(200).json({ 
      message: 'Lançamento atualizado com sucesso!', 
      data: result.rows[0] 
    });
  } catch (err) {
    console.error('Erro ao atualizar lançamento:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// --- Endpoint para excluir lançamentos (Cliente) ---
app.delete('/api/lancamentos', authMiddleware, async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'IDs não fornecidos.' });
  }

  try {
    // Verificar se todos os lançamentos pertencem ao cliente
    const checkResult = await pool.query(
      'SELECT id FROM lancamentos WHERE id = ANY($1) AND cliente_id = $2',
      [ids, req.cliente.id]
    );
    
    if (checkResult.rows.length !== ids.length) {
      return res.status(403).json({ error: 'Acesso negado a um ou mais lançamentos.' });
    }

    const result = await pool.query(
      'DELETE FROM lancamentos WHERE id = ANY($1) AND cliente_id = $2 RETURNING id',
      [ids, req.cliente.id]
    );

    res.status(200).json({ 
      message: `${result.rows.length} lançamento(s) excluído(s) com sucesso!` 
    });
  } catch (err) {
    console.error('Erro ao excluir lançamentos:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// GET para buscar lançamentos por mês/ano
app.get('/api/lancamentos', async (req, res) => {
  const { mes, ano } = req.query;
  
  try {
    // Sua lógica para buscar do banco de dados
    const lancamentos = await buscarLancamentos(mes, ano);
    res.json(lancamentos);
  } catch (error) {
    console.error('Erro ao buscar lançamentos:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Endpoint para buscar lançamentos do cliente autenticado ---
app.get('/api/lancamentos', authMiddleware, async (req, res) => {
  try {
    const { mes, ano } = req.query;

    if (!mes || !ano) {
      return res.status(400).json({ error: 'Parâmetros de mês e ano são obrigatórios.' });
    }

    const month = parseInt(mes, 10);
    const year = parseInt(ano, 10);

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

    const query = `
      SELECT 
        id,
        fornecedor,
        contadesmembrada AS "contaDesmembrada",
        categoria,
        contacorrente AS "contaCorrente",
        datacompra AS "dataCompra",
        valorcompra AS "valorCompra",
        quantidadeparcelas AS "quantidadeParcelas",
        valorparcela AS "valorParcela",
        parcelaatual AS "parcelaAtual",
        datavencimento AS "dataVencimento",
        tipodocumento AS "tipoDocumento",
        numerodocumento AS "numeroDocumento",
        observacao
      FROM lancamentos 
      WHERE cliente_id = $1 
      AND datacompra >= $2 
      AND datacompra <= $3
      ORDER BY datacompra ASC
    `;
    
    const result = await pool.query(query, [req.cliente.id, startDate, endDate]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar lançamentos:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// --- Endpoint para atualizar lançamento (Cliente) ---
app.put('/api/lancamentos/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const lancamento = req.body;

  try {
    const checkResult = await pool.query(
      'SELECT cliente_id FROM lancamentos WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0 || checkResult.rows[0].cliente_id !== req.cliente.id) {
      return res.status(403).json({ error: 'Acesso negado a este lançamento.' });
    }

    const query = `
      UPDATE lancamentos SET
        fornecedor = $2,
        categoria = $3,
        contacorrente = $4,
        datacompra = $5,
        datavencimento = $6,
        valorcompra = $7,
        observacao = $8,
        quantidadeparcelas = $9,
        valorparcela = $10,
        parcelaatual = $11,
        tipodocumento = $12,
        numerodocumento = $13,
        contadesmembrada = $14
      WHERE id = $1 AND cliente_id = $15
      RETURNING 
        id,
        fornecedor,
        contadesmembrada AS "contaDesmembrada",
        categoria,
        contacorrente AS "contaCorrente",
        datacompra AS "dataCompra",
        valorcompra AS "valorCompra",
        quantidadeparcelas AS "quantidadeParcelas",
        valorparcela AS "valorParcela",
        parcelaatual AS "parcelaAtual",
        datavencimento AS "dataVencimento",
        tipodocumento AS "tipoDocumento",
        numerodocumento AS "numeroDocumento",
        observacao
    `;
    
    const values = [
      id,
      lancamento.fornecedor,
      lancamento.categoria,
      lancamento.contaCorrente,
      lancamento.dataCompra,
      lancamento.dataVencimento || lancamento.dataCompra,
      lancamento.valorCompra,
      lancamento.observacao || null,
      lancamento.quantidadeParcelas || null,
      lancamento.valorParcela || null,
      lancamento.parcelaAtual || null,
      lancamento.tipoDocumento || null,
      lancamento.numeroDocumento || null,
      lancamento.contaDesmembrada || 'nao',
      req.cliente.id
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lançamento não encontrado.' });
    }

    res.status(200).json({ 
      message: 'Lançamento atualizado com sucesso!', 
      data: result.rows[0] 
    });
  } catch (err) {
    console.error('Erro ao atualizar lançamento:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// --- Endpoint para excluir lançamento específico ---
app.delete('/api/lancamentos/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM lancamentos WHERE id = $1 AND cliente_id = $2 RETURNING id',
      [id, req.cliente.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lançamento não encontrado.' });
    }

    res.status(200).json({ message: 'Lançamento excluído com sucesso!' });
  } catch (err) {
    console.error('Erro ao excluir lançamento:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// --- Endpoint para excluir lançamento (Admin) ---
app.delete('/api/admin/lancamentos/:id', adminAuthMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM lancamentos WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lançamento não encontrado.' });
    }

    res.status(200).json({ message: 'Lançamento excluído com sucesso!' });
  } catch (err) {
    console.error('Erro ao excluir lançamento:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// --- Endpoints Omie para Clientes ---
app.post('/api/omie/fornecedores', authMiddleware, async (req, res) => {
    try {
        const response = await axios.post('https://app.omie.com.br/api/v1/geral/clientes/', {
            call: 'ListarClientes',
            app_key: req.cliente.omie_app_key,
            app_secret: req.cliente.omie_app_secret,
            param: [{
                pagina: 1,
                registros_por_pagina: 500,
                apenas_importado_api: "N"
            }]
        });
        
        const fornecedores = response.data.clientes_cadastro.filter(cliente => 
            cliente.tags && cliente.tags.some(tag => tag.tag === 'Fornecedor')
        );
        
        res.json(fornecedores);
    } catch (error) {
        console.error('Erro ao buscar fornecedores:', error);
        res.status(500).json({ error: 'Erro ao buscar fornecedores da Omie' });
    }
});

app.post('/api/omie/categorias', authMiddleware, async (req, res) => {
    try {
        const response = await axios.post('https://app.omie.com.br/api/v1/geral/categorias/', {
            call: 'ListarCategorias',
            app_key: req.cliente.omie_app_key,
            app_secret: req.cliente.omie_app_secret,
            param: [{
                pagina: 1,
                registros_por_pagina: 500
            }]
        });
        
        res.json(response.data.categoria_cadastro || []);
    } catch (error) {
        console.error('Erro ao buscar categorias:', error);
        res.status(500).json({ error: 'Erro ao buscar categorias da Omie' });
    }
});

// --- Endpoints Omie para Admin (precisam receber o clienteId) ---
app.post('/api/admin/omie/fornecedores', adminAuthMiddleware, async (req, res) => {
    try {
        const { clienteId } = req.body;
        
        if (!clienteId) {
            return res.status(400).json({ error: 'ID do cliente não fornecido' });
        }
        
        // CORREÇÃO: Busca as credenciais do cliente no PostgreSQL (pool)
        const clienteResult = await pool.query(
            'SELECT omie_app_key, omie_app_secret FROM clientes WHERE id = $1',
            [clienteId]
        );
            
        if (clienteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        
        const clienteData = clienteResult.rows[0];
        
        const response = await axios.post('https://app.omie.com.br/api/v1/geral/clientes/', {
            call: 'ListarClientes',
            app_key: clienteData.omie_app_key,
            app_secret: clienteData.omie_app_secret,
            param: [{
                pagina: 1,
                registros_por_pagina: 500,
                apenas_importado_api: "N"
            }]
        });
        
        const fornecedores = response.data.clientes_cadastro.filter(cliente => 
            cliente.tags && cliente.tags.some(tag => tag.tag === 'Fornecedor')
        );
        
        res.json(fornecedores);
    } catch (error) {
        console.error('Erro ao buscar fornecedores:', error.message);
        res.status(500).json({ error: 'Erro ao buscar fornecedores da Omie' });
    }
});


app.post('/api/admin/omie/contas-correntes', adminAuthMiddleware, async (req, res) => {
    try {
        const { clienteId } = req.body;
        
        if (!clienteId) {
            return res.status(400).json({ error: 'ID do cliente não fornecido' });
        }
        
        const clienteResult = await pool.query(
            'SELECT omie_app_key, omie_app_secret FROM clientes WHERE id = $1',
            [clienteId]
        );
            
        if (clienteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        
        const clienteData = clienteResult.rows[0];
        
        const response = await axios.post('https://app.omie.com.br/api/v1/geral/contacorrente/', {
            call: 'ListarContasCorrentes',
            app_key: clienteData.omie_app_key,
            app_secret: clienteData.omie_app_secret,
            param: [{
                pagina: 1,
                registros_por_pagina: 500,
                filtrar_apenas_ativo: "S"
            }]
        });

        const contasCorrentesBruto = response.data.ListarContasCorrentes || [];
        
        // Filtrar contas de crédito
        const contasCredito = contasCorrentesBruto.filter(conta => {
            const descricao = conta.descricao ? conta.descricao.toUpperCase() : '';
            return descricao.includes('CREDITO') || descricao.includes('CRÉDITO');
        });

        const listaContasCredito = contasCredito.map(conta => ({
            codigo: conta.nCodCC,
            descricao: conta.descricao
        }));
        
        res.json(listaContasCredito);
        
    } catch (error) {
        const errorDetails = error.response?.data?.faultstring || error.message;
        console.error('Erro ao buscar contas correntes:', errorDetails);
        res.status(500).json({ error: 'Erro ao buscar contas correntes da Omie' });
    }
});

app.post('/api/admin/omie/categorias', adminAuthMiddleware, async (req, res) => {
    try {
        const { clienteId } = req.body;
        
        if (!clienteId) {
            return res.status(400).json({ error: 'ID do cliente não fornecido' });
        }
        
        // CORREÇÃO: Busca as credenciais do cliente no PostgreSQL (pool)
        const clienteResult = await pool.query(
            'SELECT omie_app_key, omie_app_secret FROM clientes WHERE id = $1',
            [clienteId]
        );
            
        if (clienteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        
        const clienteData = clienteResult.rows[0];
        
        const response = await axios.post('https://app.omie.com.br/api/v1/geral/categorias/', {
            call: 'ListarCategorias',
            app_key: clienteData.omie_app_key,
            app_secret: clienteData.omie_app_secret,
            param: [{
                pagina: 1,
                registros_por_pagina: 500
            }]
        });
        
        res.json(response.data.categoria_cadastro || []);
    } catch (error) {
        console.error('Erro ao buscar categorias:', error.message);
        res.status(500).json({ error: 'Erro ao buscar categorias da Omie' });
    }
});


app.post('/api/omie/contas-correntes', authMiddleware, async (req, res) => {
    try {
        const appKey = req.cliente.omie_app_key;
        const appSecret = req.cliente.omie_app_secret; 
        
        // Verificação omitida por brevidade, assumindo que você já a fez acima.

        const response = await axios.post('https://app.omie.com.br/api/v1/geral/contacorrente/', {
            call: 'ListarContasCorrentes',
            app_key: appKey,
            app_secret: appSecret,
            
            // Usamos o padrão que resolveu o erro WS_PARAMS (JSON-RPC)
            param: [{
                pagina: 1,
                registros_por_pagina: 500,
                filtrar_apenas_ativo: "S" 
            }]
        });

        // 🟢 CORREÇÃO CRÍTICA: USAR A PROPRIEDADE DE RETORNO CORRETA QUE VOCÊ DESCOBRIU!
        const contasCorrentesBruto = response.data.ListarContasCorrentes || []; 
        
        console.log(`[Omie Contas SUCESSO] TOTAL BRUTO DE CONTAS RECEBIDAS: ${contasCorrentesBruto.length}`); 
        
        if (contasCorrentesBruto.length === 0) {
            return res.json([]); 
        }
        
        // FILTRO: Busca por "CREDITO" ou "CRÉDITO" (agora ele vai funcionar)
        const contasCredito = contasCorrentesBruto.filter(conta => {
            const descricao = conta.descricao ? conta.descricao.toUpperCase() : '';
            return descricao.includes('CREDITO') || 
                   descricao.includes('CRÉDITO');
        });

        const listaContasCredito = contasCredito.map(conta => ({
             codigo: conta.nCodCC, // Usar nCodCC como código é mais seguro
             descricao: conta.descricao
        }));
        
        console.log(`[Omie Contas SUCESSO] Total de Contas de CRÉDITO filtradas: ${listaContasCredito.length}`); 
        
        res.json(listaContasCredito);
        
    } catch (error) {
        const errorDetails = error.response?.data?.faultstring || error.message;
        console.error('❌ ERRO AO BUSCAR CONTAS OMIE:', errorDetails);
        res.status(500).json({ error: 'Erro ao buscar contas correntes da Omie: ' + errorDetails });
    }
});

// --- Endpoint para lançar no Omie (Admin) ---
app.post('/api/admin/omie/lancamentos-lote', adminAuthMiddleware, async (req, res) => {
    try {
        const { lancamentos, clienteId } = req.body;
        
        if (!clienteId) {
            return res.status(400).json({ error: 'ID do cliente não fornecido' });
        }
        
        const clienteResult = await pool.query(
            'SELECT omie_app_key, omie_app_secret FROM clientes WHERE id = $1',
            [clienteId]
        );
            
        if (clienteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        
        const clienteData = clienteResult.rows[0];
        
        const results = [];
        const errors = [];
        
        for (const lancamento of lancamentos) {
            try {
                // Ajuste os campos para o formato esperado pela Omie
                const lancamentoOmie = {
                    codigo_lancamento_integracao: lancamento.codigo_lancamento_integracao,
                    codigo_cliente_fornecedor: lancamento.codigo_cliente_fornecedor,
                    id_conta_corrente: lancamento.id_conta_corrente,
                    data_vencimento: lancamento.data_vencimento,
                    data_emissao: lancamento.data_emissao,
                    valor_documento: lancamento.valor_documento,
                    codigo_categoria: lancamento.codigo_categoria,
                    observacao: lancamento.observacao,
                    numero_documento: lancamento.numero_documento
                };

                const response = await axios.post('https://app.omie.com.br/api/v1/financas/contapagar/', {
                    call: 'IncluirContaPagar',
                    app_key: clienteData.omie_app_key,
                    app_secret: clienteData.omie_app_secret,
                    param: [lancamentoOmie]
                });
                
                results.push(response.data);
            } catch (error) {
                errors.push({
                    lancamento,
                    error: error.response?.data?.faultstring || error.message
                });
                console.error('Erro ao lançar:', error.response?.data);
            }
        }
        
        if (errors.length > 0) {
            return res.status(207).json({ 
                message: `${results.length} lançamentos enviados com sucesso, ${errors.length} com erro`,
                results,
                errors
            });
        }
        
        res.json({ 
            message: `${results.length} lançamentos enviados com sucesso`,
            results 
        });
    } catch (error) {
        console.error('Erro ao lançar para Omie:', error);
        res.status(500).json({ 
            error: 'Erro ao processar lançamentos',
            details: error.response?.data || error.message
        });
    }
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'API Azenha Cartões',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      login: '/api/login',
      adminLogin: '/api/admin/login',
      health: '/api/health'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    database: pool ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});


app.listen(port, () => {
    console.log(`Back-end rodando em http://localhost:${port}`);
});
