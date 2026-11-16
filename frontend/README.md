# Frontend

React 19 + Vite. Run the full application from the project root using `scripts/start.ps1`.

For frontend development, keep the API running on port 3000 and run `npm run dev` in this directory. Vite proxies `/api` to the local API. Run `npm run build` for production assets.

The ivory/charcoal/sage palette is defined in `src/index.css` and `src/App.css`. `TrackEditor.jsx` owns the three-step form; `Arrangement.jsx` owns the timeline; `ui.jsx` contains shared controls, icons, formatting, and API helpers.
