#!/bin/bash
set -e

echo "🚀 Deploy - Azenha Cartões"
echo "🌐 Domínio: azenhacartoes.askbar.com.br"
echo "================================"
echo ""

# Verificar se docker-compose existe
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ ERRO: docker-compose.yml não encontrado"
    exit 1
fi

# Verificar estrutura
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ ERRO: Pastas backend/ ou frontend/ não encontradas"
    exit 1
fi

echo "🔍 Verificando rede do Traefik..."
if ! docker network ls | grep -q traefik_network; then
    echo "📡 Criando rede traefik_network..."
    docker network create traefik_network
    echo "   ✅ Rede criada"
else
    echo "   ✅ Rede já existe"
fi

echo ""
echo "🛑 Parando containers antigos..."
docker-compose down 2>/dev/null || true
echo "   ✅ Containers parados"

echo ""
echo "🧹 Limpando imagens antigas..."
docker image prune -f > /dev/null 2>&1
echo "   ✅ Limpeza concluída"

echo ""
echo "🏗️  Buildando imagens (pode demorar alguns minutos)..."
docker-compose build --no-cache

echo ""
echo "🚀 Iniciando containers..."
docker-compose up -d

echo ""
echo "⏳ Aguardando containers iniciarem..."
sleep 15

echo ""
echo "📊 Status dos containers:"
docker-compose ps

echo ""
echo "📋 Logs dos containers:"
echo ""
echo "=== BACKEND ==="
docker logs --tail 20 azenha-backend
echo ""
echo "=== FRONTEND ==="
docker logs --tail 20 azenha-frontend

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "📋 URLs do sistema:"
echo "   Frontend: https://azenhacartoes.askbar.com.br"
echo "   API:      https://api.azenhacartoes.askbar.com.br"
echo "   Admin:    https://azenhacartoes.askbar.com.br/admin"
echo ""
echo "🎉 Acesse: https://azenhacartoes.askbar.com.br"