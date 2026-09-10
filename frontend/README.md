# Woodstar frontend

Vite 6 + React 19 + TypeScript + Tailwind v4 single-page app: public storefront (`/`, `/order/:id`, `/pickup/:token`) and admin (`/admin/*`).

```bash
npm install
npm run dev        # http://localhost:3000, proxies /api → http://localhost:8080
npm run build      # tsc --noEmit && vite build → dist/
```


Language: Estonian default, English toggle, stored in `localStorage["woodstar.lang"]`. All strings live in `src/i18n/{et,en}.ts`.
