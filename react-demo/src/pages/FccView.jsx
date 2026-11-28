// src/pages/FccView.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Info, Search, X, ArrowLeft, Loader2 } from 'lucide-react';
import { safeFetch } from '../utils/safeFetch';
import { useFooterRight } from '../components/DashboardLayout';
import { useDropdownOptions } from '../hooks/useDropdownOptions';
import {
  formatMediaUrl,
  MediaThumb,
  CardGridSkeleton,
  EmptyState,
  ErrorState,
  ProductDetailModal,
  FccControllerTabs,
  FccDetailModal,
  PaginationBar
} from '../components/CatalogUI';

const DEFAULT_PAGE_SIZE = 12;

export default function FccView() {
  const [fccs, setFccs] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedProductRelatedMap, setSelectedProductRelatedMap] = useState(() => new Map());
  const [detailFcc, setDetailFcc] = useState(null);
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
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  const searchInputRef = useRef(null);
  const { options: dbOptions } = useDropdownOptions();

  const hasSearched = activeSearch.length > 0;

  const brandShortcuts = useMemo(() => {
    const list = Array.isArray(dbOptions.brand) ? dbOptions.brand : [];
    return list
      .filter((item) => item?.value && item.value !== 'Others')
      .slice(0, 8);
  }, [dbOptions.brand]);

  useFooterRight(
    hasSearched && pagination.total > 0
      ? `第 ${pagination.page} / ${Math.max(1, pagination.totalPages)} 页 · 共 ${pagination.total} 条匹配记录`
      : ''
  );

  const rawApiBase = process.env.REACT_APP_API_BASE || '';
  const BASE_URL = /^https?:\/\//i.test(rawApiBase) ? rawApiBase.replace(/\/+$/, '') : '';
  const API_FCCS = `${BASE_URL}/api/fccs`;
  const API_PRODUCTS = `${BASE_URL}/api/products`;

  const fetchFccs = useCallback(
    async (search = '', targetPage = 1, targetPageSize = DEFAULT_PAGE_SIZE) => {
      const keyword = search.trim();
      if (!keyword) {
        setFccs([]);
        setPagination({ page: 1, pageSize: targetPageSize, total: 0, totalPages: 0 });
        setLoading(false);
        setSearching(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(targetPageSize),
          search: keyword
        });
        const url = `${API_FCCS}?${params.toString()}`;
        const res = await safeFetch(url);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          setFccs(data);
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
          setFccs(items);
          setPagination(nextPagination);
          if (nextPagination.page && nextPagination.page !== targetPage) {
            setPage(nextPagination.page);
          }
        }
      } catch (err) {
        console.error('❌ 获取 FCC 列表失败:', err);
        setError(err.message);
        setFccs([]);
        setPagination({ page: 1, pageSize: targetPageSize, total: 0, totalPages: 0 });
      } finally {
        setLoading(false);
        setSearching(false);
      }
    },
    [API_FCCS]
  );

  // 搜索防抖：清空输入框时回到大气初始检索态；输入关键词后自动查询
  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (trimmed === activeSearch) {
      setSearching(false);
      return;
    }
    if (trimmed === '') {
      setSearching(false);
      setActiveSearch('');
      setFccs([]);
      setPagination({ page: 1, pageSize, total: 0, totalPages: 0 });
      setError(null);
      setPage(1);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      setActiveSearch(trimmed);
      setPage(1);
    }, 450);
    return () => clearTimeout(timer);
  }, [searchTerm, activeSearch, pageSize]);

  useEffect(() => {
    if (!activeSearch) return;
    fetchFccs(activeSearch, page, pageSize);
  }, [activeSearch, page, pageSize, fetchFccs]);

  const getRelatedProducts = useCallback(
    (ids) => {
      if (!Array.isArray(ids) || ids.length === 0) return [];
      return ids.map((id) => selectedProductRelatedMap.get(id)).filter(Boolean);
    },
    [selectedProductRelatedMap]
  );

  // 点击控制器时立即打开详情弹窗，再按需请求该单个产品的关联关系
  const handleSelectProduct = useCallback(
    async (product) => {
      if (!product) return;
      setSelectedProduct(product);
      setSelectedProductRelatedMap(new Map());
      try {
        const res = await safeFetch(`${API_PRODUCTS}/${product.id}/relations`);
        if (!res.ok) return;
        const raw = await res.json();
        const rel = raw?.success && raw?.data ? raw.data : raw || {};
        const compatible = Array.isArray(rel.compatible) ? rel.compatible : [];
        const mutualReplacement = Array.isArray(rel.mutualReplacement) ? rel.mutualReplacement : [];
        const replacement = Array.isArray(rel.replacement) ? rel.replacement : [];
        const upgrade = Array.isArray(rel.upgrade) ? rel.upgrade : [];

        const map = new Map();
        [...compatible, ...mutualReplacement, ...replacement, ...upgrade].forEach((item) => {
          if (item?.id != null) map.set(item.id, item);
        });
        setSelectedProductRelatedMap(map);
        setSelectedProduct((prev) =>
          prev && prev.id === product.id
            ? {
                ...prev,
                compatibleIds: compatible.map((p) => p.id),
                mutualReplacementIds: mutualReplacement.map((p) => p.id),
                replacementIds: replacement.map((p) => p.id),
                upgradeIds: upgrade.map((p) => p.id)
              }
            : prev
        );
      } catch (err) {
        console.error('❌ 获取产品关联关系失败:', err);
      }
    },
    [API_PRODUCTS]
  );

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value.trim() === '') {
      setSearching(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      searchInputRef.current?.focus();
      return;
    }
    setSearching(false);
    if (trimmed === activeSearch) {
      fetchFccs(trimmed, 1, pageSize);
    } else {
      setActiveSearch(trimmed);
      setPage(1);
    }
  };

  const handleQuickSearch = (keyword) => {
    const trimmed = String(keyword || '').trim();
    if (!trimmed) return;
    setSearchTerm(trimmed);
    setSearching(false);
    setActiveSearch(trimmed);
    setPage(1);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setActiveSearch('');
    setFccs([]);
    setPagination({ page: 1, pageSize, total: 0, totalPages: 0 });
    setError(null);
    setPage(1);
    setSearching(false);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const handlePageSizeChange = (nextSize) => {
    setPageSize(nextSize);
    setPage(1);
  };

  const renderResults = () => {
    if (loading) {
      return <CardGridSkeleton count={Math.min(pageSize, 6)} />;
    }

    if (error) {
      return (
        <ErrorState
          message={error}
          onRetry={() => fetchFccs(activeSearch, page, pageSize)}
        />
      );
    }

    if (fccs.length === 0) {
      return (
        <EmptyState
          title="未找到相关 FCC ID"
          description={`没有找到与 "${activeSearch}" 匹配的 FCC 记录，请检查编号拼写或尝试品牌关键词。`}
          actionLabel="返回重新查询"
          onAction={clearSearch}
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

              <div className="flex-1 min-w-0 p-3.5 sm:p-4 flex flex-col justify-center gap-2.5">
                <div className="min-w-0">
                  <h3
                    className="text-[15px] font-semibold font-mono text-slate-900 truncate leading-snug"
                    title={fcc.name || ''}
                  >
                    <span className="font-sans text-xs font-medium text-slate-400">FCCID：</span>
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

            {/* 适配的控制器 */}
            <FccControllerTabs
              fccProducts={fcc.Products}
              onSelectProduct={handleSelectProduct}
              baseUrl={BASE_URL}
              className="mt-auto"
            />

            {/* 底部操作栏：查看详情 */}
            <div className="px-4 py-2.5 border-t border-slate-200/70 bg-white">
              <button
                type="button"
                onClick={() => setDetailFcc(fcc)}
                className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700 transition-colors whitespace-nowrap"
              >
                <Info className="w-3.5 h-3.5" />
                查看详情
              </button>
            </div>
          </article>
        ))}
      </div>
    );
  };

  // 未搜索时：不展示卡片，呈现大气居中的专业检索界面
  if (!hasSearched) {
    return (
      <section className="min-h-[calc(100vh-14.5rem)] flex flex-col justify-center py-10 sm:py-16">
        <div className="w-full max-w-4xl mx-auto">
          {/* 顶部主标题区 */}
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs sm:text-sm font-medium tracking-wide text-indigo-600">
              Echance Tech · FCC 认证与控制器适配库
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-slate-900 leading-tight [text-wrap:balance]">
              FCCID 精准查询
            </h2>
            <p className="mt-4 text-sm sm:text-base text-slate-500 leading-relaxed">
              输入设备背面的 FCC ID 编号、品牌名称或产品描述关键词，快速定位对应认证参数及适配遥控器与接收器。
            </p>
          </div>

          {/* 核心检索框 */}
          <form
            onSubmit={handleSearchSubmit}
            className="mt-9 sm:mt-11 max-w-2xl mx-auto"
            role="search"
            aria-label="FCCID 检索"
          >
            <div className="relative flex items-center bg-white border border-slate-200 rounded-2xl shadow-[0_8px_30px_rgb(15,23,42,0.06)] focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all duration-200 p-2 pl-4 sm:pl-5">
              <Search
                aria-hidden="true"
                className="w-5 h-5 text-slate-400 shrink-0 mr-3"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="输入 FCC ID（如 KUJCE10311）、品牌或关键词..."
                aria-label="输入 FCC ID、品牌或关键词"
                autoFocus
                className="flex-1 min-w-0 h-11 sm:h-12 bg-transparent text-base sm:text-[17px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              {searching && (
                <Loader2
                  aria-hidden="true"
                  className="w-4 h-4 text-indigo-500 animate-spin shrink-0 mx-2"
                />
              )}
              {searchTerm && !searching && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    searchInputRef.current?.focus();
                  }}
                  aria-label="清空输入"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 mr-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                className="inline-flex items-center justify-center h-11 sm:h-12 px-6 sm:px-7 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm sm:text-[15px] font-medium text-white transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              >
                查询
              </button>
            </div>

            {/* 数据库动态品牌快捷检索 */}
            {brandShortcuts.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-xs sm:text-sm text-slate-500">
                <span className="text-slate-400 mr-1">快捷品牌检索：</span>
                {brandShortcuts.map((brand) => (
                  <button
                    key={brand.value}
                    type="button"
                    onClick={() => handleQuickSearch(brand.value)}
                    className="px-2.5 py-1 rounded-md text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors whitespace-nowrap"
                  >
                    {brand.label || brand.value}
                  </button>
                ))}
              </div>
            )}
          </form>

          {/* 底部极简说明栏（无嵌套卡片、无虚假数据、保持桌面端大气格局） */}
          <div className="mt-14 sm:mt-16 pt-8 border-t border-slate-200/80 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                01. FCC ID 编号检索
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
                直接输入遥控器电池仓或接收器标签上的 FCC ID，精确匹配认证参数与调速规格。
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                02. 品牌与规格筛选
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
                支持通过品牌名称、设备类型或功能描述模糊匹配，快速定位同一系列产品。
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                03. 适配控制器直达
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
                查询结果自动展示适配的控制套件、遥控器及接收器，点击即可查看详细参数与说明书。
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // 已搜索状态：顶部紧凑检索栏 + 匹配结果内容 + 分页
  return (
    <div>
      <div className="mb-6 pb-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={clearSearch}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              返回
            </button>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 truncate">
              FCCID 查询结果
            </h2>
          </div>
          <p className="mt-1.5 text-sm text-slate-500 tabular-nums">
            {loading
              ? `正在检索 "${activeSearch}"...`
              : `关键词 "${activeSearch}" · 共找到 ${pagination.total} 条匹配记录`}
          </p>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="flex items-center gap-2 w-full lg:w-[440px] shrink-0"
          role="search"
        >
          <div className="relative flex-1 min-w-0">
            <Search
              aria-hidden="true"
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="输入 FCC ID、品牌或描述关键词..."
              aria-label="搜索 FCC ID"
              className="w-full h-10 pl-10 pr-9 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="清空搜索"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center h-10 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-medium text-white transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            查询
          </button>
        </form>
      </div>

      {renderResults()}

      {!error && pagination.total > 0 && (
        <PaginationBar
          page={pagination.page}
          pageSize={pageSize}
          total={pagination.total}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          loading={loading}
          itemLabel="条 FCC 记录"
        />
      )}

      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        getRelatedProducts={getRelatedProducts}
        baseUrl={BASE_URL}
      />

      <FccDetailModal
        fcc={detailFcc}
        onClose={() => setDetailFcc(null)}
        baseUrl={BASE_URL}
      />
    </div>
  );
}
