// src/pages/FccView.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { Package, ExternalLink, FileText, X } from 'lucide-react';
import { safeFetch } from '../utils/safeFetch';
import { useFooterRight } from '../components/DashboardLayout';
import {
  formatMediaUrl,
  MediaThumb,
  PageToolbar,
  CardGridSkeleton,
  EmptyState,
  ErrorState
} from '../components/CatalogUI';

export default function FccView() {
  const [fccs, setFccs] = useState([]);
  useFooterRight(fccs.length > 0 ? `当前显示 ${fccs.length} 条 FCC 记录` : '');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  // 关联产品查看模态框
  const [selectedFcc, setSelectedFcc] = useState(null);
  const [associatedProducts, setAssociatedProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState('');

  const rawApiBase = process.env.REACT_APP_API_BASE || '';
  const BASE_URL = /^https?:\/\//i.test(rawApiBase) ? rawApiBase.replace(/\/+$/, '') : '';
  const API_FCCS = `${BASE_URL}/api/fccs`;

  const fetchFccs = useCallback(async (search = '') => {
    setLoading(true);
    setError(null);
    try {
      const url = search
        ? `${API_FCCS}?search=${encodeURIComponent(search)}`
        : API_FCCS;
      const res = await safeFetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setFccs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('❌ 获取 FCC 列表失败:', err);
      setError(err.message);
      setFccs([]);
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, [API_FCCS]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      fetchFccs();
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      fetchFccs(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, fetchFccs]);

  const handleOpenProducts = async (fcc) => {
    setSelectedFcc(fcc);
    setAssociatedProducts([]);
    setProductsError('');
    setProductsLoading(true);
    try {
      const res = await safeFetch(`${API_FCCS}/${fcc.id}/products`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setAssociatedProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setProductsError(err.message || '加载关联产品失败');
    } finally {
      setProductsLoading(false);
    }
  };

  const closeProductsModal = () => {
    setSelectedFcc(null);
    setAssociatedProducts([]);
    setProductsError('');
  };

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

  const renderContent = () => {
    if (loading) {
      return <CardGridSkeleton count={6} />;
    }

    if (error) {
      return <ErrorState message={error} onRetry={() => fetchFccs(searchTerm)} />;
    }

    if (fccs.length === 0) {
      return (
        <EmptyState
          title={searchTerm ? '未找到相关 FCC ID' : '暂无 FCC ID 数据'}
          description={
            searchTerm
              ? `没有找到包含 "${searchTerm}" 的 FCC 记录，请尝试其他关键词。`
              : '当前库中没有任何 FCC ID 信息。'
          }
          actionLabel={searchTerm ? '查看所有 FCC ID' : undefined}
          onAction={searchTerm ? clearSearch : undefined}
        />
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {fccs.map((fcc) => (
          <article
            key={fcc.id}
            className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden"
          >
            {/* 上半部分：正方形图片 + FCC 核心信息 */}
            <div className="flex flex-row border-b border-slate-100">
              <div className="w-36 sm:w-40 aspect-square shrink-0 bg-slate-50 border-r border-slate-100 overflow-hidden">
                <MediaThumb
                  src={formatMediaUrl(fcc.image, BASE_URL)}
                  alt={fcc.name || 'FCC 图片'}
                  className="w-full h-full aspect-square object-cover"
                />
              </div>

              <div className="flex-1 min-w-0 p-3.5 sm:p-4 flex flex-col justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-400">FCC ID</p>
                  <h3
                    className="text-[15px] font-semibold font-mono text-slate-900 truncate mt-0.5"
                    title={fcc.name || ''}
                  >
                    {fcc.name || '—'}
                  </h3>
                </div>

                <dl className="space-y-1.5 text-xs">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <dt className="text-slate-400 shrink-0 w-10">品牌</dt>
                    <dd className="text-slate-700 font-medium truncate">{fcc.brand || '—'}</dd>
                  </div>
                  <div className="flex items-baseline gap-2 min-w-0">
                    <dt className="text-slate-400 shrink-0 w-10">类型</dt>
                    <dd className="text-slate-700 font-medium truncate">{fcc.productType || '—'}</dd>
                  </div>
                  <div className="flex items-baseline gap-2 min-w-0">
                    <dt className="text-slate-400 shrink-0 w-10">规格</dt>
                    <dd className="text-slate-700 truncate" title={fcc.speed || ''}>
                      {fcc.speed || '—'}
                    </dd>
                  </div>
                  {fcc.replacement && (
                    <div className="flex items-baseline gap-2 min-w-0">
                      <dt className="text-slate-400 shrink-0 w-10">替换</dt>
                      <dd className="text-emerald-700 font-medium truncate">{fcc.replacement}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {/* 中间：描述 */}
            <div className="px-4 py-3 flex-1 bg-white">
              <p className="text-xs font-medium text-slate-400 mb-1">描述</p>
              <p
                className="text-sm text-slate-600 line-clamp-2 leading-relaxed min-h-[2.625rem]"
                title={fcc.description || ''}
              >
                {fcc.description || '暂无描述'}
              </p>
            </div>

            {/* 底部操作栏 */}
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/70 mt-auto">
              <button
                type="button"
                onClick={() => handleOpenProducts(fcc)}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700 transition-colors whitespace-nowrap"
              >
                <Package className="w-4 h-4" />
                查看关联产品
              </button>
            </div>
          </article>
        ))}
      </div>
    );
  };

  const subtitleText = searchTerm && !loading
    ? `搜索 "${searchTerm}" · 共 ${fccs.length} 条记录`
    : loading
      ? '正在加载 FCC ID 记录...'
      : `共 ${fccs.length} 条 FCC 记录`;

  return (
    <div>
      <PageToolbar
        title="FCCID 查询"
        subtitle={subtitleText}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onClearSearch={clearSearch}
        searchPlaceholder="输入 FCC ID 或描述关键词搜索..."
        searching={searching}
        loading={loading}
      />

      {renderContent()}

      {/* 关联产品模态框 */}
      {selectedFcc && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900 truncate">
                  关联产品 — <span className="font-mono">{selectedFcc.name}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {selectedFcc.brand || '无品牌'}
                  <span aria-hidden="true" className="mx-1.5 text-slate-300">·</span>
                  {selectedFcc.productType || '无类型'}
                  {selectedFcc.speed ? (
                    <>
                      <span aria-hidden="true" className="mx-1.5 text-slate-300">·</span>
                      {selectedFcc.speed}
                    </>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={closeProductsModal}
                aria-label="关闭"
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {productsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
                </div>
              ) : productsError ? (
                <p className="text-sm text-rose-600 text-center py-10">{productsError}</p>
              ) : associatedProducts.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-10">当前 FCC ID 暂无关联产品</p>
              ) : (
                <div className="space-y-3">
                  {associatedProducts.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-start gap-4 p-3.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-16 h-16 aspect-square bg-slate-50 rounded-lg border border-slate-100 overflow-hidden shrink-0">
                        <MediaThumb
                          src={formatMediaUrl(p.image, BASE_URL)}
                          alt={p.model || '产品'}
                          className="w-full h-full aspect-square object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <p className="text-sm font-semibold text-slate-900">{p.model || '未命名型号'}</p>
                          {p.sku && (
                            <span className="text-xs font-mono text-slate-500 tabular-nums">
                              SKU: {p.sku}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {p.brand || '无品牌'}
                          <span aria-hidden="true" className="mx-1.5 text-slate-300">·</span>
                          {p.productType || '无类型'}
                        </p>
                        {p.description && (
                          <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">{p.description}</p>
                        )}
                        {(p.httpLink || p.manual) && (
                          <div className="flex flex-wrap gap-4 mt-2 text-xs">
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
                                href={formatMediaUrl(p.manual, BASE_URL)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-medium"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                查看 PDF 说明书
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
