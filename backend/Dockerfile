# Usa a imagem oficial do Node para a execução
FROM node:20-slim

# Define a porta que a sua API escuta
EXPOSE 3001

# Define o diretório de trabalho dentro do contêiner
WORKDIR /usr/src/app

# Copia package.json e package-lock.json e instala as dependências
COPY package*.json ./
RUN npm ci --only=production

# Copia o restante do código da API
COPY . .

# Comando para iniciar a API
CMD ["node", "index.js"]