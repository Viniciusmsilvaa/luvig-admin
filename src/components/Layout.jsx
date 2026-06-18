import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-luvig-cloud md:flex">
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-950/55 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
        />
      )}
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
