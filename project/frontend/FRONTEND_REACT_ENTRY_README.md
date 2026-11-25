# JSX entry correction

- The Vite entry point is now `src/main.jsx` (React JSX).
- React/React DOM dependencies are added.
- The former imperative renderer is retained as `src/legacy-app.js` to preserve existing API, routing, authentication and forms while migration proceeds.
- `index.html` now mounts React at `#root`.

Install dependencies using `npm install`, then run `npm run dev`.
This is a React entry and mounting layer, not a complete component-by-component rewrite of the legacy UI yet.
