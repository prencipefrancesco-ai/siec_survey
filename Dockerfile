FROM node:20-alpine

WORKDIR /app

# Copia file di dipendenze
COPY package*.json ./

# Installazione dipendenze di produzione
RUN npm ci --omit=dev

# Copia codice sorgente
COPY . .

# Esponi porta predefinita (override da $PORT di Railway)
EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "start"]
