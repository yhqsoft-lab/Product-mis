// src/pages/FccView.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Info } from 'lucide-react';
import { safeFetch } from '../utils/safeFetch';
import { useFooterRight } from '../components/DashboardLayout';
import {
  formatMediaUrl,
  MediaThumb,
  PageToolbar,
  CardGridSkeleton,
  EmptyState,
  ErrorState,
  ProductDetailModal,
  FccControllerTabs,
  FccDetailModal
} from '../components/CatalogUI';

export default function FccView() {
  const [fccs, setFccs] = useState([]);
  useFooterRight(fccs.length > 0 ? `当前显示 ${fccs.length} 条 FCC 记录` : '');
  const [allProducts, setAllProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailFcc, setDetailFcc] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  const rawApiBase = process.env.REACT_APP_API_BASE || '';
  const BASE_URL = /^https?:\/\//i.test(rawApiBase) ? rawApiBase.replace(/\/+$/, '') : '';
  const API_FCCS = `${BASE_URL}/api/fccs`;
  const API_PRODUCTS = `${BASE_URL}/api/products`;

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

  useEffect(() => {
    let active = true;
    const fetchAllProducts = async () => {
      try {
        const res = await safeFetch(API_PRODUCTS);
        if (!res.ok) return;
        const data = await res.json();
        if (active) {
          setAllProducts(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('❌ 获取产品库失败:', err);
      }
    };
    fetchAllProducts();
    return () => {
      active = false;
    };
  }, [API_PRODUCTS]);

  const productMap = useMemo(() => {
    const map = new Map();
    allProducts.forEach((p) => map.set(p.id, p));
    return map;
  }, [allProducts]);

  const getRelatedProducts = useCallback(
    (ids) => {
      if (!Array.isArray(ids) || ids.length === 0) return [];
      return allProducts.filter((p) => ids.includes(p.id));
    },
    [allProducts]
  );

  const handleSelectProduct = useCallback(
    (product) => {
      if (!product) return;
      setSelectedProduct(productMap.get(product.id) || product);
    },
    [productMap]
  );

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

            {/* 适配的控制器（与后台 FCCID 管理保持统一风格） */}
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
        searchPlaceholder="输入 FCC ID、品牌或描述关键词搜索..."
        searching={searching}
        loading={loading}
      />

      {renderContent()}

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
