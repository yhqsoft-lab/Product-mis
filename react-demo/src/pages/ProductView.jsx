import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ExternalLink,
  FileText,
  FileSpreadsheet,
  HardDrive,
  Info
} from 'lucide-react';
import { safeFetch } from '../utils/safeFetch';
import { useFooterRight } from '../components/DashboardLayout';
import {
  formatMediaUrl,
  getStatusMeta,
  MediaThumb,
  PageToolbar,
  CardGridSkeleton,
  EmptyState,
  ErrorState,
  showAppToast,
  ProductDetailModal,
  ProductRelationModal,
  PaginationBar
} from '../components/CatalogUI';

const DEFAULT_PAGE_SIZE = 12;

export default function ProductSearch() {
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searching, setSearching] = useState(false);

  useFooterRight(
    pagination.total > 0
      ? `第 ${pagination.page} / ${Math.max(1, pagination.totalPages)} 页 · 共 ${pagination.total} 个产品`
      : ''
  );

  // 关联产品查看状态（统一 Tab 弹窗）
  const [relationModalState, setRelationModalState] = useState({
    isOpen: false,
    product: null,
    initialTab: 'compatible'
  });

  const openRelationModal = useCallback((product, tab = 'compatible') => {
    setRelationModalState({
      isOpen: true,
      product,
      initialTab: tab
    });
  }, []);

  const closeRelationModal = useCallback(() => {
    setRelationModalState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // 详情模态框堆栈（支持点击关联产品弹出新详情弹窗）
  const [detailModalStack, setDetailModalStack] = useState([]);

  const openDetailModal = useCallback((product, relationLabel = '') => {
    if (!product) return;
    setDetailModalStack((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].product?.id === product.id) {
        return prev;
      }
      return [...prev, { product, relationLabel }];
    });
  }, []);

  const closeTopDetailModal = useCallback(() => {
    setDetailModalStack((prev) => prev.slice(0, -1));
  }, []);

  // API 地址（仅当配置了完整 http(s) 地址时使用，否则使用同源相对路径）
  const rawApiBase = process.env.REACT_APP_API_BASE || '';
  const BASE_URL = /^https?:\/\//i.test(rawApiBase) ? rawApiBase.replace(/\/+$/, '') : '';
  const API_PRODUCTS = `${BASE_URL}/api/products`;

  const fetchAllProducts = useCallback(async () => {
    try {
      const res = await safeFetch(API_PRODUCTS);
      if (!res.ok) throw new Error('获取产品列表失败');
      const data = await res.json();
      setAllProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('获取所有产品失败:', err);
    }
  }, [API_PRODUCTS]);

  const fetchProducts = useCallback(async (search = '', targetPage = 1, targetPageSize = DEFAULT_PAGE_SIZE) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(targetPageSize)
      });
      if (search.trim()) {
        params.set('search', search.trim());
      }
      const url = `${API_PRODUCTS}?${params.toString()}`;

      const res = await safeFetch(url);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        setProducts(data);
        setPagination({
          page: 1,
          pageSize: targetPageSize,
          total: data.length,
          totalPages: data.length > 0 ? Math.ceil(data.length / targetPageSize) : 0
        });
      } else {
        const items = Array.isArray(data.items) ? data.items : [];
        const nextPagination = data.pagination || {
          page: targetPage,
          pageSize: targetPageSize,
          total: items.length,
          totalPages: items.length > 0 ? 1 : 0
        };
        setProducts(items);
        setPagination(nextPagination);
        if (nextPagination.page && nextPagination.page !== targetPage) {
          setPage(nextPagination.page);
        }
      }
    } catch (err) {
      console.error('❌ 获取产品失败:', err);
      setError(err.message);
      setProducts([]);
      setPagination({ page: 1, pageSize: targetPageSize, total: 0, totalPages: 0 });
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, [API_PRODUCTS]);

  useEffect(() => {
    fetchAllProducts();
  }, [fetchAllProducts]);

  // 搜索防抖：关键词变化时重置至第 1 页
  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (trimmed === activeSearch) {
      setSearching(false);
      return;
    }
    if (trimmed === '') {
      setSearching(false);
      setActiveSearch('');
      setPage(1);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      setActiveSearch(trimmed);
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm, activeSearch]);

  useEffect(() => {
    fetchProducts(activeSearch, page, pageSize);
  }, [activeSearch, page, pageSize, fetchProducts]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value.trim() === '') {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setActiveSearch('');
    setPage(1);
    setSearching(false);
  };

  const handlePageSizeChange = (nextSize) => {
    setPageSize(nextSize);
    setPage(1);
  };

  const relatedProductMap = useMemo(() => {
    const map = new Map();
    allProducts.forEach((p) => {
      if (p?.id != null) map.set(p.id, p);
    });
    products.forEach((p) => {
      if (p?.id != null) map.set(p.id, p);
      ['compatibleProducts', 'upgradeProducts', 'mutualReplacementProducts', 'replacementProducts'].forEach((key) => {
        if (Array.isArray(p?.[key])) {
          p[key].forEach((rel) => {
            if (rel?.id != null && !map.has(rel.id)) {
              map.set(rel.id, rel);
            }
          });
        }
      });
    });
    return map;
  }, [allProducts, products]);

  const getRelatedProducts = useCallback(
    (ids) => {
      if (!ids || !Array.isArray(ids)) return [];
      return ids.map((id) => relatedProductMap.get(id)).filter(Boolean);
    },
    [relatedProductMap]
  );

  const renderProductList = () => {
    if (loading) {
      return <CardGridSkeleton count={Math.min(pageSize, 6)} />;
    }

    if (error) {
      return <ErrorState message={error} onRetry={() => fetchProducts(activeSearch, page, pageSize)} />;
    }

    if (products.length === 0) {
      return (
        <EmptyState
          title={searchTerm ? '未找到相关产品' : '暂无产品数据'}
          description={
            searchTerm
              ? `没有找到包含 "${searchTerm}" 的产品，请尝试其他关键词。`
              : '当前产品库中没有任何产品信息。'
          }
          actionLabel={searchTerm ? '查看所有产品' : undefined}
          onAction={searchTerm ? clearSearch : undefined}
        />
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {products.map((product) => {
          const statusMeta = getStatusMeta(product.status);
          const compatibleCount = product.compatibleIds?.length || 0;
          const upgradeCount = product.upgradeIds?.length || 0;
          const mutualReplacementCount = product.mutualReplacementIds?.length || 0;
          const replacementCount = product.replacementIds?.length || 0;

          return (
            <article
              id={`product-${product.id}`}
              key={product.id}
              className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden"
            >
              {/* 上半部分：正方形图片 + 关键信息 */}
              <div className="flex flex-row border-b border-slate-100">
                <div className="w-36 sm:w-40 aspect-square shrink-0 bg-slate-50 border-r border-slate-100 overflow-hidden">
                  <MediaThumb
                    src={formatMediaUrl(product.image, BASE_URL)}
                    alt={product.model || '产品图片'}
                    className="w-full h-full aspect-square object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0 p-3 sm:p-3.5 flex flex-col justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className="text-[15px] font-semibold text-slate-900 truncate leading-snug"
                        title={product.model || ''}
                      >
                        <span className="font-normal text-slate-400 mr-1">Model:</span>
                        {product.model || '未命名型号'}
                      </h3>
                      <span className={`text-xs font-medium whitespace-nowrap shrink-0 ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 truncate">
                      <span className="font-mono tabular-nums" title={product.sku || ''}>
                        SKU: {product.sku || '—'}
                      </span>
                      <span aria-hidden="true" className="mx-1.5 text-slate-300">·</span>
                      <span>{product.productType || '无类型'}</span>
                    </p>
                  </div>

                  {/* 在售链接、说明书、QA文档与NAS文档链接 */}
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                    {product.httpLink ? (
                      <a
                        href={product.httpLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium whitespace-nowrap"
                        title={product.httpLink}
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        在售链接
                      </a>
                    ) : (
                      <span
                        aria-disabled="true"
                        className="inline-flex items-center gap-1 text-slate-300 cursor-not-allowed select-none whitespace-nowrap"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        在售链接
                      </span>
                    )}

                    {product.manual ? (
                      <a
                        href={formatMediaUrl(product.manual, BASE_URL)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium whitespace-nowrap"
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        说明书
                      </a>
                    ) : (
                      <span
                        aria-disabled="true"
                        className="inline-flex items-center gap-1 text-slate-300 cursor-not-allowed select-none whitespace-nowrap"
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        说明书
                      </span>
                    )}

                    {product.qaDocument ? (
                      <a
                        href={formatMediaUrl(product.qaDocument, BASE_URL)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium whitespace-nowrap"
                        title={product.qaDocument}
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                        QA文档
                      </a>
                    ) : (
                      <span
                        aria-disabled="true"
                        className="inline-flex items-center gap-1 text-slate-300 cursor-not-allowed select-none whitespace-nowrap"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                        QA文档
                      </span>
                    )}

                    {product.nasLink ? (
                      /^https?:\/\//i.test(product.nasLink.trim()) ? (
                        <a
                          href={product.nasLink.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-700 font-medium whitespace-nowrap"
                          title={product.nasLink}
                        >
                          <HardDrive className="w-3.5 h-3.5 shrink-0" />
                          NAS文档链接
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (navigator.clipboard?.writeText) {
                              navigator.clipboard.writeText(product.nasLink.trim())
                                .then(() => showAppToast('已复制 NAS 文档路径，请打开资源管理器粘贴', 'success'))
                                .catch(() => showAppToast(`NAS 路径：${product.nasLink.trim()}`, 'info'));
                            } else {
                              showAppToast(`NAS 路径：${product.nasLink.trim()}`, 'info');
                            }
                          }}
                          className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-700 font-medium whitespace-nowrap text-left"
                          title={`点击复制 NAS 路径：${product.nasLink}`}
                        >
                          <HardDrive className="w-3.5 h-3.5 shrink-0" />
                          NAS文档链接
                        </button>
                      )
                    ) : (
                      <span
                        aria-disabled="true"
                        className="inline-flex items-center gap-1 text-slate-300 cursor-not-allowed select-none whitespace-nowrap"
                      >
                        <HardDrive className="w-3.5 h-3.5 shrink-0" />
                        NAS文档链接
                      </span>
                    )}
                  </div>

                  {/* 关联快捷入口 */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums">
                    <button
                      type="button"
                      onClick={() => {
                        if (compatibleCount > 0) openRelationModal(product, 'compatible');
                      }}
                      disabled={compatibleCount === 0}
                      className={`whitespace-nowrap transition-colors ${
                        compatibleCount > 0
                          ? 'text-emerald-700 hover:text-emerald-800 hover:underline font-medium'
                          : 'text-slate-400 cursor-default'
                      }`}
                    >
                      互匹配 {compatibleCount}
                    </button>
                    <span aria-hidden="true" className="text-slate-200">/</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (mutualReplacementCount > 0) openRelationModal(product, 'mutual_replacement');
                      }}
                      disabled={mutualReplacementCount === 0}
                      className={`whitespace-nowrap transition-colors ${
                        mutualReplacementCount > 0
                          ? 'text-sky-700 hover:text-sky-800 hover:underline font-medium'
                          : 'text-slate-400 cursor-default'
                      }`}
                    >
                      互替代 {mutualReplacementCount}
                    </button>
                    <span aria-hidden="true" className="text-slate-200">/</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (replacementCount > 0) openRelationModal(product, 'replacement');
                      }}
                      disabled={replacementCount === 0}
                      className={`whitespace-nowrap transition-colors ${
                        replacementCount > 0
                          ? 'text-amber-700 hover:text-amber-800 hover:underline font-medium'
                          : 'text-slate-400 cursor-default'
                      }`}
                    >
                      可替代 {replacementCount}
                    </button>
                    <span aria-hidden="true" className="text-slate-200">/</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (upgradeCount > 0) openRelationModal(product, 'upgrade');
                      }}
                      disabled={upgradeCount === 0}
                      className={`whitespace-nowrap transition-colors ${
                        upgradeCount > 0
                          ? 'text-indigo-600 hover:text-indigo-800 hover:underline font-medium'
                          : 'text-slate-400 cursor-default'
                      }`}
                    >
                      升级款 {upgradeCount}
                    </button>
                  </div>

                  {/* 开发原型 */}
                  <p
                    className="text-xs text-slate-600 truncate"
                    title={`开发原型：${[product.brand, product.productfccId].filter(Boolean).join(' ') || '—'}`}
                  >
                    <span className="text-slate-400">开发原型：</span>
                    {product.brand || product.productfccId ? (
                      <>
                        {product.brand && (
                          <span className="font-medium text-slate-700">{product.brand}</span>
                        )}
                        {product.brand && product.productfccId && ' '}
                        {product.productfccId && (
                          <span className="font-mono tabular-nums text-slate-700">
                            {product.productfccId}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </p>
                </div>
              </div>

              {/* 中间：描述 */}
              <div className="px-4 py-3 flex-1 bg-white">
                <p className="text-xs font-medium text-slate-400 mb-1">描述</p>
                <p
                  className="text-sm text-slate-600 line-clamp-2 leading-relaxed min-h-[2.625rem]"
                  title={product.description || ''}
                >
                  {product.description || '暂无描述'}
                </p>
              </div>

              {/* 底部操作栏 */}
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/70 mt-auto">
                <button
                  type="button"
                  onClick={() => openDetailModal(product)}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700 transition-colors whitespace-nowrap"
                >
                  <Info className="w-4 h-4" />
                  查看详情
                </button>
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  const subtitleText = activeSearch && !loading
    ? `搜索 "${activeSearch}" · 共 ${pagination.total} 个结果`
    : loading
      ? '正在同步产品目录...'
      : `共 ${pagination.total} 个产品`;

  return (
    <div>
      <PageToolbar
        title="产品目录"
        subtitle={subtitleText}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onClearSearch={clearSearch}
        searchPlaceholder="输入 SKU、Model 搜索..."
        searching={searching}
        loading={loading}
      />

      {renderProductList()}

      {!error && (
        <PaginationBar
          page={pagination.page}
          pageSize={pageSize}
          total={pagination.total}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          loading={loading}
          itemLabel="个产品"
        />
      )}

      {/* 关联产品模态框（含可匹配 / 升级款 / 可替代 Tab） */}
      <ProductRelationModal
        isOpen={relationModalState.isOpen}
        onClose={closeRelationModal}
        product={relationModalState.product}
        initialTab={relationModalState.initialTab}
        getRelatedProducts={getRelatedProducts}
        baseUrl={BASE_URL}
        onSelectProduct={(p, label) => openDetailModal(p, label)}
      />

      {/* 产品详情模态框 */}
      {detailModalStack.map((entry, idx) => (
        <ProductDetailModal
          key={`${entry.product.id}-${idx}`}
          product={entry.product}
          relationLabel={entry.relationLabel}
          depth={idx}
          isTopmost={idx === detailModalStack.length - 1}
          onClose={closeTopDetailModal}
          getRelatedProducts={getRelatedProducts}
          baseUrl={BASE_URL}
        />
      ))}
    </div>
  );
}
