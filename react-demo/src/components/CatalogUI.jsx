// src/components/CatalogUI.jsx
import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  Image as ImageIcon,
  AlertCircle,
  RotateCw,
  FileText,
  Package,
  ExternalLink,
  ShoppingCart,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export const formatMediaUrl = (path, baseUrl = '') => {
  if (!path || path === 'null' || path === 'undefined') return null;
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  return `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
};

export const getStatusMeta = (status) => {
  if (status === 'active') {
    return { label: '在售', className: 'text-emerald-600' };
  }
  if (status === 'clearance') {
    return { label: '清仓', className: 'text-rose-600' };
  }
  if (status === 'discontinued') {
    return { label: '停产', className: 'text-slate-400' };
  }
  if (status === 'development') {
    return { label: '开发中', className: 'text-amber-600' };
  }
  if (status) {
    return { label: status, className: 'text-slate-600' };
  }
  return { label: '未设置', className: 'text-slate-400' };
};

export function MediaThumb({ src, alt, className = 'w-full h-full object-cover', fallbackText = '无图片' }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center text-slate-400 select-none p-2">
        <ImageIcon className="w-7 h-7 stroke-[1.5] text-slate-300 mb-1.5" />
        <span className="text-[11px] font-medium text-slate-400">{fallbackText}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || '图片'}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}

export function PageToolbar({
  title,
  subtitle,
  searchTerm,
  onSearchChange,
  onClearSearch,
  searchPlaceholder = '输入关键词搜索...',
  searching = false,
  loading = false,
  actionButton = null
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-slate-900 tracking-tight truncate">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums truncate">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
        <div className="relative flex-1 sm:w-72 lg:w-80">
          <Search
            aria-hidden="true"
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={onSearchChange}
            disabled={loading && !searching}
            className="w-full h-10 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50/70 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          />
          {searching ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full" />
            </div>
          ) : searchTerm ? (
            <button
              type="button"
              onClick={onClearSearch}
              disabled={loading}
              aria-label="清除搜索"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>

        {actionButton}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col animate-pulse"
        >
          <div className="flex flex-row border-b border-slate-100">
            <div className="w-36 sm:w-40 aspect-square shrink-0 bg-slate-100 border-r border-slate-100" />
            <div className="flex-1 p-4 space-y-3">
              <div className="h-4 bg-slate-200 rounded w-3/4" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
              <div className="pt-2 flex gap-2">
                <div className="h-3 bg-slate-100 rounded w-14" />
                <div className="h-3 bg-slate-100 rounded w-14" />
              </div>
            </div>
          </div>
          <div className="px-4 py-3 space-y-2">
            <div className="h-3 bg-slate-100 rounded w-10" />
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-4/5" />
          </div>
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/70">
            <div className="h-8 bg-slate-200/80 rounded-lg w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl py-16 px-6 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
        <Search className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1.5">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md mb-5">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="bg-white border border-rose-200 rounded-xl py-14 px-6 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 mb-4">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">数据加载失败</h3>
      <p className="text-sm text-rose-600 max-w-md mb-5">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
        >
          <RotateCw className="w-4 h-4" />
          重试
        </button>
      )}
    </div>
  );
}

export function showAppToast(message, type = 'info') {
  const toast = document.createElement('div');
  const toneClass =
    type === 'success'
      ? 'bg-emerald-600'
      : type === 'error'
        ? 'bg-rose-600'
        : 'bg-slate-800';
  toast.className = `fixed top-5 right-5 px-4 py-2.5 rounded-lg shadow-lg z-[60] text-sm font-medium text-white transition-all duration-200 ${toneClass}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px)';
    setTimeout(() => toast.remove(), 220);
  }, 2800);
}

const RELATED_GROUPS = [
  {
    key: 'compatibleIds',
    label: '可匹配产品',
    accentClass: 'text-emerald-700'
  },
  {
    key: 'upgradeIds',
    label: '升级款产品',
    accentClass: 'text-indigo-700'
  },
  {
    key: 'replacementIds',
    label: '可替换产品',
    accentClass: 'text-amber-700'
  }
];

export function ProductDetailModal({
  product,
  onClose,
  getRelatedProducts,
  baseUrl = '',
  relationLabel = '',
  depth = 0,
  isTopmost = true
}) {
  const [expandedRelatedKey, setExpandedRelatedKey] = useState(null);

  useEffect(() => {
    setExpandedRelatedKey(null);
  }, [product?.id]);

  useEffect(() => {
    if (!isTopmost || !product) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTopmost, product, onClose]);

  if (!product) return null;

  const statusMeta = getStatusMeta(product.status);
  const resolvedGroups = RELATED_GROUPS.map((group) => ({
    ...group,
    items: getRelatedProducts ? getRelatedProducts(product[group.key]) : []
  }));

  return (
    <div
      className={`fixed inset-0 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4 ${
        depth > 0 ? 'z-[60]' : 'z-50'
      }`}
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 truncate">
              {relationLabel ? `关联产品详情 · ${relationLabel}` : '产品详情'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums truncate">
              {product.model || '未命名型号'} · SKU {product.sku || '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/40">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">型号 (Model)</label>
              <p className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 break-words">
                {product.model || '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">SKU</label>
              <p className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 font-mono tabular-nums break-all">
                {product.sku || '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">产品类型</label>
              <p className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900">
                {product.productType || '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">状态</label>
              <p className={`px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium ${statusMeta.className}`}>
                {statusMeta.label}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">描述信息</label>
            <p className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 min-h-[76px] whitespace-pre-wrap leading-relaxed">
              {product.description || '暂无描述'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">产品外链</label>
              <div className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm truncate">
                {product.httpLink ? (
                  <a
                    href={product.httpLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline"
                  >
                    {product.httpLink}
                  </a>
                ) : (
                  <span className="text-slate-400">无</span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">说明书 (PDF)</label>
              <div className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm truncate">
                {product.manual ? (
                  <a
                    href={formatMediaUrl(product.manual, baseUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline inline-flex items-center gap-1.5"
                  >
                    <FileText className="w-4 h-4 shrink-0" />
                    查看 PDF 说明书
                  </a>
                ) : (
                  <span className="text-slate-400">无</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">关联产品</label>
            <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-3.5 text-sm">
              {resolvedGroups.map((group, groupIdx) => (
                <div
                  key={group.key}
                  className={`${groupIdx > 0 ? 'border-t border-slate-100 pt-3 ' : ''}flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3`}
                >
                  <span className="text-xs font-medium text-slate-500 w-24 shrink-0">
                    {group.label}
                  </span>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {group.items.length > 0 ? (
                      group.items.map((p) => {
                        const itemKey = `${group.key}-${p.id}`;
                        const isExpanded = expandedRelatedKey === itemKey;
                        return (
                          <div key={p.id}>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedRelatedKey((prev) => (prev === itemKey ? null : itemKey))
                              }
                              aria-expanded={isExpanded}
                              className={`w-full text-left flex items-start justify-between gap-2 px-2 py-1 -mx-2 rounded-lg text-sm leading-relaxed transition-colors cursor-pointer ${
                                isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <span className="break-words min-w-0">
                                <span className="text-slate-500">Model：</span>
                                <span className={`font-medium ${group.accentClass}`}>
                                  {p.model || '—'}
                                </span>
                                <span className="text-slate-400">，</span>
                                <span className="text-slate-500">SKU：</span>
                                <span className="font-mono tabular-nums text-slate-800">
                                  {p.sku || '—'}
                                </span>
                                <span className="text-slate-400">，</span>
                                <span className="text-slate-500">产品类型：</span>
                                <span className="text-slate-800">
                                  {p.productType || '—'}
                                </span>
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs text-slate-400 shrink-0 mt-0.5 whitespace-nowrap">
                                <ImageIcon className="w-3.5 h-3.5" />
                                <span>{isExpanded ? '收起' : '图片'}</span>
                              </span>
                            </button>
                            {isExpanded && (
                              <div className="mt-2 mb-1 p-3 bg-slate-50/80 border border-slate-200 rounded-lg inline-flex flex-col items-center">
                                <div className="w-40 h-40 aspect-square rounded-lg overflow-hidden border border-slate-200 bg-white">
                                  <MediaThumb
                                    src={formatMediaUrl(p.image, baseUrl)}
                                    alt={p.model || '关联产品图片'}
                                    className="w-full h-full object-contain bg-white"
                                    fallbackText="暂无图片"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-slate-400">无</span>
                    )}
                  </div>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                <span className="text-xs font-medium text-slate-500 w-24 shrink-0">
                  完美替代
                </span>
                <div className="flex-1 min-w-0 text-sm text-slate-800 break-words">
                  {product.brand || product.productfccId ? (
                    <>
                      {product.brand && <span className="font-medium text-slate-900">{product.brand}</span>}
                      {product.brand && product.productfccId && ' '}
                      {product.productfccId && (
                        <span className="font-mono tabular-nums text-slate-700">{product.productfccId}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-400">无</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">产品图片</label>
            <div className="p-4 bg-white border border-slate-200 rounded-lg flex justify-center items-center min-h-[180px]">
              {product.image ? (
                <div className="w-56 h-56 aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                  <MediaThumb
                    src={formatMediaUrl(product.image, baseUrl)}
                    alt={product.model || '产品图片'}
                    className="w-full h-full object-contain bg-white"
                  />
                </div>
              ) : (
                <span className="text-sm text-slate-400">暂无图片</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const RELATION_MODAL_TABS = [
  {
    id: 'compatible',
    key: 'compatibleIds',
    label: '可匹配',
    fullName: '可匹配产品',
    activeClass: 'border-emerald-600 text-emerald-700 bg-emerald-50/40',
    countActiveClass: 'text-emerald-700'
  },
  {
    id: 'upgrade',
    key: 'upgradeIds',
    label: '升级款',
    fullName: '升级款产品',
    activeClass: 'border-indigo-600 text-indigo-700 bg-indigo-50/40',
    countActiveClass: 'text-indigo-700'
  },
  {
    id: 'replacement',
    key: 'replacementIds',
    label: '可替代',
    fullName: '可替代产品',
    activeClass: 'border-amber-600 text-amber-700 bg-amber-50/40',
    countActiveClass: 'text-amber-700'
  }
];

export function ProductRelationModal({
  isOpen,
  onClose,
  product,
  initialTab = 'compatible',
  getRelatedProducts,
  baseUrl = '',
  onSelectProduct
}) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'compatible');
    }
  }, [isOpen, initialTab, product?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  const tabsWithItems = RELATION_MODAL_TABS.map((tab) => ({
    ...tab,
    items: getRelatedProducts ? getRelatedProducts(product[tab.key]) : []
  }));

  const currentTab = tabsWithItems.find((t) => t.id === activeTab) || tabsWithItems[0];

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[82vh] overflow-hidden flex flex-col shadow-xl">
        {/* 顶部标题 + Tab 切换 */}
        <div className="border-b border-slate-200 bg-white">
          <div className="px-6 pt-4 pb-3 flex justify-between items-center gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900 truncate">关联产品</h3>
              {product.model && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  当前产品：{product.model}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            role="tablist"
            aria-label="关联产品分类"
            className="px-6 flex items-center gap-1"
          >
            {tabsWithItems.map((tab) => {
              const isActive = tab.id === currentTab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap tabular-nums rounded-t-md ${
                    isActive
                      ? tab.activeClass
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`ml-1.5 text-xs ${
                      isActive ? tab.countActiveClass : 'text-slate-400'
                    }`}
                  >
                    {tab.items.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 列表内容（不显示 Brand） */}
        <div className="p-5 overflow-y-auto flex-1">
          {currentTab.items.length > 0 ? (
            <div className="space-y-3">
              {currentTab.items.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-4 p-3 border border-slate-200 rounded-lg hover:border-indigo-200 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => onSelectProduct && onSelectProduct(p, currentTab.fullName)}
                >
                  <div className="w-14 h-14 aspect-square bg-slate-50 rounded-lg border border-slate-100 overflow-hidden shrink-0">
                    <MediaThumb
                      src={formatMediaUrl(p.image, baseUrl)}
                      alt={p.model || '产品'}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {p.model || '未命名型号'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      <span className="font-mono tabular-nums">SKU: {p.sku || '—'}</span>
                      <span aria-hidden="true" className="mx-1.5 text-slate-300">·</span>
                      <span>{p.productType || '无类型'}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-10">
              暂无{currentTab.fullName}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const CONTROLLER_TABS = ['Control Kit', 'Remote', 'Receiver'];

const getControllersByTab = (fccProducts, tabName) => {
  const target = tabName.toLowerCase();
  return (Array.isArray(fccProducts) ? fccProducts : []).filter(
    (p) => (p.productType || '').trim().toLowerCase() === target
  );
};

export function FccControllerTabs({
  fccProducts = [],
  onSelectProduct,
  baseUrl = '',
  className = ''
}) {
  const [selectedTab, setSelectedTab] = useState(null);

  const grouped = CONTROLLER_TABS.reduce((acc, tab) => {
    acc[tab] = getControllersByTab(fccProducts, tab);
    return acc;
  }, {});

  const totalCount = CONTROLLER_TABS.reduce(
    (sum, tab) => sum + grouped[tab].length,
    0
  );

  const defaultTab =
    CONTROLLER_TABS.find((tab) => grouped[tab].length > 0) || CONTROLLER_TABS[0];
  const currentTab = selectedTab || defaultTab;
  const currentProducts = grouped[currentTab] || [];

  return (
    <div className={`border-t border-slate-100 bg-slate-50/70 ${className}`}>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Package className="w-3.5 h-3.5 text-slate-400" />
          适配的控制器
        </span>
        <span className="text-[11px] text-slate-400 tabular-nums">
          共 {totalCount} 款
        </span>
      </div>

      <div
        role="tablist"
        aria-label="适配的控制器分类"
        className="px-4 grid grid-cols-3 border-b border-slate-200/80"
      >
        {CONTROLLER_TABS.map((tab) => {
          const isActive = currentTab === tab;
          const count = grouped[tab].length;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedTab(tab)}
              className={`pb-2 pt-1 text-xs font-medium border-b-2 transition-colors whitespace-nowrap text-center tabular-nums ${
                isActive
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>{tab}</span>
              <span
                className={`ml-1 text-[11px] ${
                  isActive ? 'text-indigo-600' : 'text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="px-4 py-3">
        {currentProducts.length > 0 ? (
          <div className="space-y-2 max-h-44 overflow-y-auto">
            {currentProducts.map((p) => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectProduct && onSelectProduct(p)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (onSelectProduct) onSelectProduct(p);
                  }
                }}
                className="flex items-center gap-2.5 p-2 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 aspect-square bg-slate-50 rounded-md border border-slate-100 overflow-hidden shrink-0">
                  <MediaThumb
                    src={formatMediaUrl(p.image, baseUrl)}
                    alt={p.model || '产品'}
                    className="w-full h-full aspect-square object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-xs font-semibold text-slate-900 truncate"
                    title={p.model || ''}
                  >
                    <span className="font-normal text-slate-400 mr-1">Model:</span>
                    {p.model || '未命名型号'}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 tabular-nums truncate mt-0.5">
                    SKU: {p.sku || '—'}
                  </p>
                </div>
                {(p.httpLink || p.manual) && (
                  <div className="flex items-center gap-1 shrink-0">
                    {p.httpLink && (
                      <a
                        href={p.httpLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="购买"
                        aria-label="购买"
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-indigo-600 bg-indigo-50/70 hover:bg-indigo-100/80 rounded-md transition-colors whitespace-nowrap"
                      >
                        <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                        <span>购买</span>
                      </a>
                    )}
                    {p.manual && (
                      <a
                        href={formatMediaUrl(p.manual, baseUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="查看 PDF 说明书"
                        aria-label="查看 PDF 说明书"
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-3">
            暂无适配的 {currentTab}
          </p>
        )}
      </div>
    </div>
  );
}

const FCC_CONTROLLER_GROUPS = [
  { key: 'Control Kit', label: 'Control Kit', accentClass: 'text-indigo-700' },
  { key: 'Remote', label: 'Remote', accentClass: 'text-emerald-700' },
  { key: 'Receiver', label: 'Receiver', accentClass: 'text-amber-700' }
];

export function FccDetailModal({ fcc, onClose, baseUrl = '' }) {
  const [expandedKey, setExpandedKey] = useState(null);

  useEffect(() => {
    setExpandedKey(null);
  }, [fcc?.id]);

  useEffect(() => {
    if (!fcc) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fcc, onClose]);

  if (!fcc) return null;

  const linkedProducts = Array.isArray(fcc.Products) ? fcc.Products : [];
  const resolvedGroups = FCC_CONTROLLER_GROUPS.map((group) => ({
    ...group,
    items: getControllersByTab(linkedProducts, group.key)
  }));

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 truncate">FCCID 详情</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">
              FCCID：{fcc.name || '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/40">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">FCC ID</label>
              <p className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-mono text-slate-900 break-all">
                {fcc.name || '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">品牌 (Brand)</label>
              <p className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900">
                {fcc.brand || '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">产品类型</label>
              <p className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900">
                {fcc.productType || '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">规格 (AC/DC)</label>
              <p className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900">
                {fcc.speed || '—'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">描述信息</label>
            <p className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 min-h-[76px] whitespace-pre-wrap leading-relaxed">
              {fcc.description || '暂无描述'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">适配的控制器</label>
            <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-3.5 text-sm">
              {resolvedGroups.map((group, groupIdx) => (
                <div
                  key={group.key}
                  className={`${groupIdx > 0 ? 'border-t border-slate-100 pt-3 ' : ''}flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3`}
                >
                  <span className="text-xs font-medium text-slate-500 w-24 shrink-0">
                    {group.label}
                  </span>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {group.items.length > 0 ? (
                      group.items.map((p) => {
                        const itemKey = `${group.key}-${p.id}`;
                        const isExpanded = expandedKey === itemKey;
                        return (
                          <div key={p.id}>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedKey((prev) => (prev === itemKey ? null : itemKey))
                              }
                              aria-expanded={isExpanded}
                              className={`w-full text-left flex items-start justify-between gap-2 px-2 py-1 -mx-2 rounded-lg text-sm leading-relaxed transition-colors cursor-pointer ${
                                isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <span className="break-words min-w-0">
                                <span className="text-slate-500">Model：</span>
                                <span className={`font-medium ${group.accentClass}`}>
                                  {p.model || '—'}
                                </span>
                                <span className="text-slate-400">，</span>
                                <span className="text-slate-500">SKU：</span>
                                <span className="font-mono tabular-nums text-slate-800">
                                  {p.sku || '—'}
                                </span>
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs text-slate-400 shrink-0 mt-0.5 whitespace-nowrap">
                                <ImageIcon className="w-3.5 h-3.5" />
                                <span>{isExpanded ? '收起' : '图片'}</span>
                              </span>
                            </button>
                            {isExpanded && (
                              <div className="mt-2 mb-1 p-3 bg-slate-50/80 border border-slate-200 rounded-lg inline-flex flex-col items-center gap-2">
                                <div className="w-40 h-40 aspect-square rounded-lg overflow-hidden border border-slate-200 bg-white">
                                  <MediaThumb
                                    src={formatMediaUrl(p.image, baseUrl)}
                                    alt={p.model || '控制器图片'}
                                    className="w-full h-full object-contain bg-white"
                                    fallbackText="暂无图片"
                                  />
                                </div>
                                {(p.httpLink || p.manual) && (
                                  <div className="flex items-center gap-3 text-xs">
                                    {p.httpLink && (
                                      <a
                                        href={p.httpLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-medium"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        产品链接
                                      </a>
                                    )}
                                    {p.manual && (
                                      <a
                                        href={formatMediaUrl(p.manual, baseUrl)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-medium"
                                      >
                                        <FileText className="w-3.5 h-3.5" />
                                        说明书
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-slate-400">无</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">产品图片</label>
            <div className="p-4 bg-white border border-slate-200 rounded-lg flex justify-center items-center min-h-[180px]">
              {fcc.image ? (
                <div className="w-56 h-56 aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                  <MediaThumb
                    src={formatMediaUrl(fcc.image, baseUrl)}
                    alt={fcc.name || 'FCC 图片'}
                    className="w-full h-full object-contain bg-white"
                  />
                </div>
              ) : (
                <span className="text-sm text-slate-400">暂无图片</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const buildPageNumbers = (currentPage, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = [1];
  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);

  if (left > 2) pages.push('ellipsis-left');
  for (let i = left; i <= right; i += 1) {
    pages.push(i);
  }
  if (right < totalPages - 1) pages.push('ellipsis-right');
  pages.push(totalPages);
  return pages;
};

export function PaginationBar({
  page = 1,
  pageSize = 12,
  total = 0,
  totalPages = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [6, 12, 24, 48],
  loading = false,
  itemLabel = '条记录',
  scrollToTop = true
}) {
  const [jumpInput, setJumpInput] = useState('');

  if (!total || total <= 0) return null;

  const effectiveTotalPages = Math.max(1, totalPages || Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), effectiveTotalPages);
  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, total);
  const pageNumbers = buildPageNumbers(safePage, effectiveTotalPages);

  const goToPage = (nextPage) => {
    const clamped = Math.min(Math.max(1, nextPage), effectiveTotalPages);
    if (clamped === safePage || loading) return;
    if (onPageChange) onPageChange(clamped);
    if (scrollToTop && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePageSizeChange = (e) => {
    const nextSize = Number(e.target.value);
    if (!Number.isInteger(nextSize) || nextSize <= 0 || nextSize === pageSize) return;
    if (onPageSizeChange) onPageSizeChange(nextSize);
    if (scrollToTop && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleJumpSubmit = (e) => {
    e.preventDefault();
    const target = Number.parseInt(jumpInput, 10);
    if (Number.isInteger(target) && target >= 1 && target <= effectiveTotalPages) {
      goToPage(target);
    }
    setJumpInput('');
  };

  return (
    <nav
      aria-label="分页导航"
      className="bg-white border border-slate-200 rounded-xl px-4 py-3 mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
    >
      {/* 左侧：记录范围与每页条数 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 tabular-nums">
        <span>
          显示第 <span className="font-medium text-slate-800">{startItem}–{endItem}</span> 条，共{' '}
          <span className="font-medium text-slate-800">{total}</span> {itemLabel}
        </span>

        {onPageSizeChange && (
          <label className="inline-flex items-center gap-1.5 text-slate-500">
            <span>每页</span>
            <select
              aria-label="每页显示数量"
              value={pageSize}
              onChange={handlePageSizeChange}
              disabled={loading}
              className="h-8 px-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} 条
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* 右侧：页码控制与快速跳转 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => goToPage(safePage - 1)}
          disabled={loading || safePage <= 1}
          aria-label="上一页"
          className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>上一页</span>
        </button>

        <div className="flex items-center gap-1">
          {pageNumbers.map((item) => {
            if (typeof item === 'string') {
              return (
                <span
                  key={item}
                  aria-hidden="true"
                  className="inline-flex items-center justify-center w-7 h-8 text-xs text-slate-400 select-none"
                >
                  …
                </span>
              );
            }
            const isActive = item === safePage;
            return (
              <button
                key={item}
                type="button"
                onClick={() => goToPage(item)}
                disabled={loading}
                aria-label={`第 ${item} 页`}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex items-center justify-center min-w-[32px] h-8 px-2 text-xs font-medium rounded-lg border transition-colors tabular-nums ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                } disabled:opacity-60`}
              >
                {item}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => goToPage(safePage + 1)}
          disabled={loading || safePage >= effectiveTotalPages}
          aria-label="下一页"
          className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <span>下一页</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {effectiveTotalPages > 5 && (
          <form onSubmit={handleJumpSubmit} className="inline-flex items-center gap-1.5 ml-1.5 text-xs text-slate-500">
            <span className="hidden sm:inline">跳至</span>
            <input
              type="number"
              min={1}
              max={effectiveTotalPages}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              placeholder={String(safePage)}
              aria-label="跳转页码"
              disabled={loading}
              className="w-12 h-8 px-2 text-center text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 tabular-nums"
            />
            <span className="hidden sm:inline">页</span>
          </form>
        )}
      </div>
    </nav>
  );
}
