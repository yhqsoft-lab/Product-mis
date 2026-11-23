import React, { useEffect, useState, useCallback } from 'react';
import {
  ExternalLink,
  FileText,
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
  ProductDetailModal,
  ProductRelationModal
} from '../components/CatalogUI';

export default function ProductSearch() {
  const [products, setProducts] = useState([]);
  useFooterRight(products.length > 0 ? `当前显示 ${products.length} 个产品` : '');
  const [allProducts, setAllProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searching, setSearching] = useState(false);

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

  const fetchProducts = useCallback(async (search = '') => {
    setLoading(true);
    setError(null);
    try {
      const url = search
        ? `${API_PRODUCTS}?search=${encodeURIComponent(search)}`
        : API_PRODUCTS;

      const res = await safeFetch(url);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('❌ 获取产品失败:', err);
      setError(err.message);
      setProducts([]);
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, [API_PRODUCTS]);

  useEffect(() => {
    fetchAllProducts();
  }, [fetchAllProducts]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      fetchProducts();
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      fetchProducts(searchTerm);
    }, 450);

    return () => clearTimeout(timer);
  }, [searchTerm, fetchProducts]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value.trim() === '') {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearching(false);
  };

  const getRelatedProducts = (ids) => {
    if (!ids || !Array.isArray(ids)) return [];
    return ids
      .map((id) => allProducts.find((p) => p.id === id))
      .filter(Boolean);
  };

  const renderProductList = () => {
    if (loading) {
      return <CardGridSkeleton count={6} />;
    }

    if (error) {
      return <ErrorState message={error} onRetry={() => fetchProducts(searchTerm)} />;
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

                  {/* 外链与说明书 */}
                  <div className="flex items-center gap-3 text-xs">
                    {product.httpLink ? (
                      <a
                        href={product.httpLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium whitespace-nowrap"
                        title={product.httpLink}
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        产品链接
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-300 whitespace-nowrap">
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        无链接
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
                      <span className="inline-flex items-center gap-1 text-slate-300 whitespace-nowrap">
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        无说明书
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
                      可匹配 {compatibleCount}
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
                  </div>

                  {/* 完美替代 */}
                  <p
                    className="text-xs text-slate-600 truncate"
                    title={`完美替代：${[product.brand, product.productfccId].filter(Boolean).join(' ') || '—'}`}
                  >
                    <span className="text-slate-400">完美替代：</span>
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

  const subtitleText = searchTerm && !loading
    ? `搜索 "${searchTerm}" · 共 ${products.length} 个结果`
    : loading
      ? '正在同步产品目录...'
      : `共 ${products.length} 个产品`;

  return (
    <div>
      <PageToolbar
        title="产品目录"
        subtitle={subtitleText}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onClearSearch={clearSearch}
        searchPlaceholder="输入 SKU、Model 或 FCC ID 搜索产品..."
        searching={searching}
        loading={loading}
      />

      {renderProductList()}

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
