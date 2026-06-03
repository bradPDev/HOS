import { useState } from 'react';
import { WebStorefront } from './components/WebStorefront';
import { StaffDashboard } from './components/StaffDashboard';

function App() {
  const [view, setView] = useState<'storefront' | 'staff'>('storefront');

  return (
    <div className="app-container">
      {view === 'storefront' ? (
        <WebStorefront onGoToStaffPortal={() => setView('staff')} />
      ) : (
        <StaffDashboard onGoToStorefront={() => setView('storefront')} />
      )}
    </div>
  );
}

export default App;
