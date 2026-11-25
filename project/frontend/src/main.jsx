import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import './carbon-theme.css';
import './atmos-polish.css';

function AtmosApp() {
  useEffect(() => {
    // The existing app's route/API/form logic is preserved in the legacy renderer
    // and mounted after React creates the root DOM container.
    import('./legacy-app.js');
  }, []);

  return <div id="app" />;
}

createRoot(document.getElementById('root')).render(<AtmosApp />);
