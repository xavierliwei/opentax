import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { to: '/intake', label: '1) Intake Uploads' },
  { to: '/interview', label: '2) Guided Interview' },
  { to: '/summary', label: '3) Compute + Explain' },
  { to: '/review', label: '4) Review / Print' },
]

export function Layout() {
  return (
    <div className="app-shell">
      <header>
        <h1>OpenTax MVP</h1>
        <p>Transparent, deterministic-prep frontend (mock computations only)</p>
      </header>
      <nav>
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
