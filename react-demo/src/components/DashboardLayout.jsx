// src/components/DashboardLayout.jsx
import React, { useState, useEffect, useMemo, createContext, useContext } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Package,
  Radio,
  Users,
  KeyRound,
  SlidersHorizontal,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  LogIn,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { useUser } from '../context/useUser';
import ChangePasswordModal from './ChangePasswordModal';

const ROUTE_META = {
  '/productview': {
    section: '前台浏览',
    title: '产品查询'
  },
  '/fccview': {
    section: '前台浏览',
    title: 'FCCID查询'
  },
  '/productcatalog': {
    section: '前台浏览',
    title: 'FCCID查询'
  },
  '/products': {
    section: '后台管理',
    title: '产品管理'
  },
  '/fccs': {
    section: '后台管理',
    title: 'FCCID管理'
  },
  '/options': {
    section: '后台管理',
    title: '下拉选项管理'
  },
  '/users': {
    section: '后台管理',
    title: '账号与角色管理'
  }
};

const NAV_GROUPS = [
  {
    label: '前台浏览',
    items: [
      { to: '/productview', label: '产品查询', icon: Search },
      { to: '/fccview', label: 'FCCID查询', icon: Radio }
    ]
  },
  {
    label: '后台管理',
    items: [
      { to: '/products', label: '产品管理', icon: Package, roles: ['admin', 'editor'] },
      { to: '/fccs', label: 'FCCID管理', icon: Radio, roles: ['admin', 'editor'] },
      { to: '/options', label: '下拉选项', icon: SlidersHorizontal, roles: ['admin', 'editor'] },
      { to: '/users', label: '账号与角色', icon: Users, roles: ['admin'] }
    ]
  }
];

const FooterContext = createContext({
  setFooterRight: () => {}
});

export function useFooterRight(text) {
  const { setFooterRight } = useContext(FooterContext);
  useEffect(() => {
    setFooterRight(text || '');
    return () => setFooterRight('');
  }, [text, setFooterRight]);
}

export default function DashboardLayout({ children, pageTitle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useUser();
  const [footerRight, setFooterRight] = useState('');

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const currentMeta = ROUTE_META[location.pathname] || {
    section: '工作台',
    title: pageTitle || '仪表盘'
  };

  const displayTitle = pageTitle || currentMeta.title;
  const canAccessAdmin = user?.role === 'admin' || user?.role === 'editor';
  const isAdminRoute =
    location.pathname.startsWith('/products') ||
    location.pathname.startsWith('/fccs') ||
    location.pathname.startsWith('/options') ||
    location.pathname.startsWith('/users');

  const visibleNavGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => {
      if (group.label !== '后台管理') return group;
      if (!isAdminRoute || !canAccessAdmin) return null;
      const items = group.items.filter(
        (item) => !item.roles || item.roles.includes(user?.role)
      );
      return items.length > 0 ? { ...group, items } : null;
    }).filter(Boolean);
  }, [isAdminRoute, canAccessAdmin, user?.role]);

  const footerContextValue = useMemo(() => ({ setFooterRight }), []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isFccRoute =
    location.pathname.startsWith('/fccview') ||
    location.pathname.startsWith('/fccs');

  const footerLeftText = isFccRoute
    ? `© ${new Date().getFullYear()} FCC ID | Copyright @ Echance Technology Co.,Ltd.`
    : `© ${new Date().getFullYear()} 产品中心 | Copyright @ Echance Technology Co.,Ltd.`;

  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const isRouteActive = (path) => location.pathname === path;

  const userInitial = (user?.username || 'U').charAt(0).toUpperCase();
  const roleLabel =
    user?.role === 'admin'
      ? '管理员'
      : user?.role === 'editor'
        ? '编辑员'
        : '成员';

  const renderSidebarContent = (isMobile = false) => {
    const collapsed = !isMobile && sidebarCollapsed;

    return (
      <div className="flex h-full flex-col bg-white border-r border-slate-200 select-none">
        {/* Sidebar Brand Bar */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-slate-200 ${
            collapsed ? 'justify-center px-3' : 'justify-between px-5'
          }`}
        >
          {!collapsed && (
            <Link
              to="/productview"
              className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
            >
              Echance Tech
            </Link>
          )}

          {isMobile ? (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="关闭侧边栏"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <X className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
              title={collapsed ? '展开侧边栏' : '收起侧边栏'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav
          aria-label="主导航"
          className="flex-1 overflow-y-auto px-3 py-5 space-y-6"
        >
          {visibleNavGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-3 mb-2 text-xs font-medium text-slate-400 whitespace-nowrap">
                  {group.label}
                </p>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isRouteActive(item.to);
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        title={collapsed ? item.label : undefined}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center min-h-[40px] rounded-lg text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                          collapsed ? 'justify-center px-2' : 'gap-3 px-3'
                        } ${
                          active
                            ? 'bg-indigo-50 text-indigo-700 font-semibold'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            active ? 'text-indigo-600' : 'text-slate-400'
                          }`}
                        />
                        {!collapsed && (
                          <span className="truncate whitespace-nowrap">
                            {item.label}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Sidebar Account Footer */}
        <div className="shrink-0 border-t border-slate-200 p-3">
          {user ? (
            <div
              className={`flex items-center ${
                collapsed ? 'flex-col gap-2' : 'justify-between gap-2 px-2 py-1.5'
              }`}
            >
              <div
                className={`flex items-center min-w-0 ${
                  collapsed ? 'justify-center' : 'gap-3'
                }`}
              >
                <div
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-semibold text-white"
                >
                  {userInitial}
                </div>
                {!collapsed && (
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {user.username}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {roleLabel}
                    </p>
                  </div>
                )}
              </div>
              <div className={`flex items-center shrink-0 ${collapsed ? 'flex-col gap-1' : 'gap-1'}`}>
                <button
                  type="button"
                  onClick={() => setShowChangePassword(true)}
                  title="修改密码"
                  aria-label="修改密码"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                >
                  <KeyRound className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={logout}
                  title="退出登录"
                  aria-label="退出登录"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <Link
              to="/login"
              title={collapsed ? '登录后台' : undefined}
              className={`flex items-center min-h-[40px] rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                collapsed ? 'justify-center px-2' : 'gap-3 px-3'
              }`}
            >
              <LogIn className="h-4 w-4 shrink-0 text-slate-500" />
              {!collapsed && (
                <span className="whitespace-nowrap">登录后台</span>
              )}
            </Link>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-[width] duration-200 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <div className="sticky top-0 h-screen">
          {renderSidebarContent(false)}
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="导航菜单"
        >
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-64 max-w-[80vw] h-full shadow-xl">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}

      {/* Right Column: Sticky Header + Main Content Viewport */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header Section */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 backdrop-blur-sm px-4 sm:px-6 lg:px-8">
          {/* Left Zone: Mobile Trigger + Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="打开导航菜单"
              className="lg:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <Menu className="h-5 w-5" />
            </button>

            <nav
              aria-label="面包屑导航"
              className="flex items-center gap-2 text-sm min-w-0"
            >
              <span className="hidden sm:inline text-slate-500 whitespace-nowrap shrink-0">
                {currentMeta.section}
              </span>
              <ChevronRight
                aria-hidden="true"
                className="hidden sm:inline h-4 w-4 text-slate-300 shrink-0"
              />
              <h1 className="font-semibold text-slate-900 truncate whitespace-nowrap">
                {displayTitle}
              </h1>
            </nav>
          </div>

          {/* Right Zone: Account Info + Single Primary Action */}
          <div className="flex items-center gap-4 shrink-0">
            {user && (
              <span className="hidden md:inline text-sm text-slate-500 whitespace-nowrap">
                {user.username}
                <span aria-hidden="true" className="mx-1.5 text-slate-300">
                  ·
                </span>
                {roleLabel}
              </span>
            )}

            {user && (
              <button
                type="button"
                onClick={() => setShowChangePassword(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-indigo-700 transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              >
                <KeyRound className="h-4 w-4 text-slate-500" />
                <span>修改密码</span>
              </button>
            )}

            {isAdminRoute ? (
              <button
                type="button"
                onClick={() => navigate('/productview')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              >
                <ExternalLink className="h-4 w-4 text-slate-500" />
                <span>前台预览</span>
              </button>
            ) : canAccessAdmin ? (
              <button
                type="button"
                onClick={() => navigate('/products')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              >
                <span>管理控制台</span>
              </button>
            ) : !user ? (
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              >
                <span>后台登录</span>
              </button>
            ) : null}
          </div>
        </header>

        {/* Main Content Area */}
        <FooterContext.Provider value={footerContextValue}>
          <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children || <Outlet />}
          </main>
        </FooterContext.Provider>

        {/* Unified Bottom Footer */}
        <footer className="mt-auto shrink-0 border-t border-gray-200 bg-white px-4 sm:px-6 lg:px-8 py-5">
          <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
            <p className="text-sm text-gray-600">{footerLeftText}</p>
            {footerRight && (
              <div className="text-sm text-gray-500">{footerRight}</div>
            )}
          </div>
        </footer>
      </div>

      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        username={user?.username || ''}
      />
    </div>
  );
}
