# Projeto X Backend

Backend separado do frontend principal. Este projeto concentra as rotas de API, autenticação, Prisma e seed do banco.

## Instalação

Backend:

```bash
git clone https://github.com/Sono-backdoend/backend.git
cd ../arraia-macabro-backend
npm install
```

## Variáveis de ambiente

Crie um arquivo `.env` com base em `.env.example`.

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/arraia_macabro"
DATABASE_URL_UNPOOLED="postgresql://usuario:senha@localhost:5432/arraia_macabro"
AUTH_SECRET="seu_secret"
NEXTAUTH_URL="http://localhost:3001"
ADMIN_EMAIL="admin@arraia.com"
ADMIN_PASSWORD="sua_senha_aqui"
ADMIN_NAME="Admin"
```


Backend `arraia-macabro-backend/`:

├── app/
│   ├── api/
│   │   ├── admin/
│   │   ├── auth/
│   │   └── invite/
│   └── generated/
├── lib/
├── prisma/
└── auth.ts

## Scripts

```bash
npm run dev
npm run build
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:studio
```

O backend sobe por padrão em `http://localhost:3001`.
