# LUVIG Admin

Base administrativa em React, Vite, Tailwind CSS e Supabase.

## Rodar localmente

```bash
npm install
npm run dev
```

Crie um arquivo `.env` com:

```env
VITE_SUPABASE_URL=https://suogtofmewywbmhkymje.supabase.co
VITE_SUPABASE_ANON_KEY=COLE_A_ANON_KEY_AQUI
VITE_CAPTCHA_SITE_KEY=COLE_A_SITE_KEY_AQUI
```

Use somente a anon public key do Supabase. Não coloque `service_role`, senha do banco ou JWT secret no frontend.

## Aplicar banco no Supabase

1. Abra o projeto no Supabase.
2. Vá em SQL Editor.
3. Execute, em ordem, todas as migrations de `supabase/migrations/001_initial_schema.sql` até `011_time_clock_management.sql`.
4. Em Authentication, crie o primeiro usuário.
5. Na tabela `profiles`, ajuste manualmente o `role` desse primeiro usuário para `admin`.
6. Depois disso, o Admin consegue gerenciar o restante da base.

## Storage

A migration cria os buckets privados:

- `employee-photos`
- `documents`
- `client-contracts`

As policies finais limitam leitura e upload por perfil e pasta. Atualização e exclusão permanentes ficam restritas ao Admin.

## Perfis

Os perfis reais vêm da tabela `profiles`:

- `admin`
- `rh`
- `lider`

Sem sessão, as rotas internas redirecionam para `/login`. Falhas do Supabase são exibidas ao usuário e nunca são substituídas por dados demonstrativos.

## Checklist de produção

- Aplicar todas as migrations e revisar o resultado no SQL Editor.
- Confirmar que os buckets continuam privados.
- Usar apenas a chave pública `anon` no frontend.
- Configurar a URL oficial em Authentication > URL Configuration.
- Criar um widget Cloudflare Turnstile para o domínio da aplicação, preencher `VITE_CAPTCHA_SITE_KEY` e configurar a secret key somente em Authentication > Bot and Abuse Protection no Supabase.
- Testar Admin, RH, Líder, Vinícius e Girlane com contas reais.
- Executar `npm run build` antes de publicar.
