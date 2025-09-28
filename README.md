# LP React Chat

Projeto React (Vite) que adapta seu `index.html`/`chat.js` para um widget de chat moderno, com build que gera arquivos *hashados* para bust de cache.

## Rodar
```bash
cp .env.example .env
npm i
npm run dev    # http://localhost:5173
npm run build  # gera dist/ com nomes hashados
```

## Config
- `VITE_API_BASE_URL` — URL do seu backend (ex.: http://localhost:9090/).
- `VITE_DEFAULT_BOT_ID` — ID do bot (padrão: 2).
- `VITE_DEFAULT_BOT_SLUG` — slug para `/sessoes/token?bot=` (padrão: tim).

## Onde está cada parte
- `src/services/botApi.js` — portas 1:1 das chamadas feitas em `chat.js` (login, trafego, start, responder, upload, download).
- `src/components/ChatWidget.jsx` — UI do chat (inclui botão de **Reset** que apaga `session_id_bot` e força **hard refresh**).
- `src/components/WebcamModal.jsx` — modal de webcam sem jQuery/Bootstrap (usa `getUserMedia`).
- `src/utils/{uuid,device}.js` — `generateUUID` e `getDeviceInfo` migrados do seu código.

> **TODO (plug and play):** No handler `handleStep(step)` você pode mapear o objeto retornado pelo seu backend (ex.: `StepResponseDTO`) para renderizar botões/listas/documentos conforme cada etapa. Hoje mostramos as chaves mais comuns (`mensagem`, `mensagens`).

## Deploy / Cache
Vite gera assets com hash no nome (ex.: `app.9a1b2c.js`), o que bust o cache automaticamente a cada build. Em Nginx, recomendo:

```nginx
location /assets/ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}
location / {
  expires -1;
  add_header Cache-Control "no-store";
  try_files $uri /index.html;
}
```

