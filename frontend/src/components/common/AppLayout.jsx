import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Ticket, 
  BookOpen, 
  User, 
  Users, 
  Bell, 
  Search, 
  Plus, 
  LogOut, 
  Menu, 
  BarChart2,
  PieChart,
  Settings,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Ticket as TicketIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import { notificationService } from '../../services/ticketService';
import { getInitials, getAvatarColor } from '../../utils/helpers';
import { motion, AnimatePresence } from 'framer-motion';
import '../../styles/dashboard-premium.css';

const NAV_ITEMS = {
  all: [
    { path: '/tickets',   label: 'Tickets',    icon: TicketIcon },
    { path: '/tickets/new', label: 'New Ticket', icon: Plus },
    { path: '/knowledge', label: 'Knowledge Base', icon: BookOpen },
  ],
  employee: [
    { path: '/profile',   label: 'Profile',    icon: User },
  ],
  support_agent: [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/tickets?myTickets=true', label: 'My Queue', icon: TrendingUp },
    { path: '/profile',   label: 'Profile',    icon: User },
  ],
  admin: [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/reports', label: 'Reports', icon: BarChart2 },
    { path: '/analytics', label: 'Analytics', icon: PieChart },
    { path: '/settings', label: 'Settings', icon: Settings },
    { path: '/profile',   label: 'Profile',    icon: User },
  ]
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { on } = useSocket();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const notifRef = useRef(null);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    notificationService.getAll({ limit: 8 })
      .then(res => {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!on) return;
    const off = on('notification', (notif) => {
      setNotifications(prev => [notif, ...prev.slice(0, 9)]);
      setUnreadCount(prev => prev + 1);
      toast.info(notif.message);
    });
    return off;
  }, [on]);

  const navItems = [
    ...NAV_ITEMS.all,
    ...(NAV_ITEMS[user?.role] || [])
  ];

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/tickets?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  return (
    <div className="premium-layout">
      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="overlay" 
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
            onClick={() => setMobileOpen(false)} 
          />
        )}
      </AnimatePresence>

      {/* PREMIUM SIDEBAR */}
      <aside className={`premium-sidebar hide-mobile ${collapsed ? 'collapsed' : ''}`} style={mobileOpen ? { display: 'flex', position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 50 } : {}}>
        <div className="premium-sidebar-brand">
          <div className="premium-brand-icon">T</div>
          <span>TicketDesk</span>
        </div>

        <nav className="premium-nav">
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', paddingLeft: '16px' }}>
            Main Menu
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `premium-nav-item ${isActive ? 'active' : ''}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '24px 16px', borderTop: '1px solid var(--border)' }}>
          <button className="premium-nav-item" onClick={logout} style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* PREMIUM MAIN WRAPPER */}
      <div className="premium-main">
        {/* TOP NAVBAR */}
        <header className="premium-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="hide-desktop" onClick={() => setMobileOpen(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
              <Menu size={24} />
            </button>
            <div className="premium-search hide-mobile">
              <Search size={18} />
              <input
                placeholder="Search anything..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
              />
            </div>
          </div>

          <div className="premium-header-actions">
            <button className="premium-btn" onClick={() => navigate('/tickets/new')}>
              <Plus size={18} />
              <span className="hide-mobile">Create Ticket</span>
            </button>

            <div style={{ position: 'relative' }} ref={notifRef}>
              <button 
                onClick={() => setNotifOpen(!notifOpen)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', position: 'relative', padding: '8px' }}
              >
                <Bell size={22} />
                {unreadCount > 0 && <span style={{ position: 'absolute', top: '8px', right: '8px', width: '8px', height: '8px', background: 'var(--danger)', borderRadius: '50%', border: '2px solid var(--card)' }} />}
              </button>
              
              <AnimatePresence>
                {notifOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    style={{ position: 'absolute', right: 0, top: '48px', width: '320px', zIndex: 100, background: 'var(--card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}
                  >
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Notifications</span>
                      <button onClick={() => setUnreadCount(0)} style={{ fontSize: '0.8rem', color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Clear</button>
                    </div>
                    <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.9rem' }}>No notifications</div>
                      ) : notifications.map(n => (
                        <div key={n._id} style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', cursor: 'pointer' }} className="premium-nav-item">
                          <div style={{ fontSize: '1.2rem' }}>🔔</div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.85rem' }}>{n.title}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '4px' }}>{n.message}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '16px', borderLeft: '1px solid var(--border)' }}>
              <div
                className="premium-avatar"
                style={{ background: getAvatarColor(user?.name) }}
              >
                {getInitials(user?.name)}
              </div>
              <div className="hide-mobile">
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' }}>{user?.name || 'User'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ') || 'Role'}</div>
              </div>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--bg)' }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        .hide-desktop { display: none; }
        @media (max-width: 1024px) {
          .hide-desktop { display: block; }
          .hide-mobile { display: none; }
          .premium-sidebar.hide-mobile { display: none; }
        }
      `}</style>
    </div>
  );
}
