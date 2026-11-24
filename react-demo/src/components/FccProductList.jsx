import React, { useState, useMemo } from 'react';
import { Trash2, Package } from 'lucide-react';
import { formatMediaUrl, MediaThumb } from './CatalogUI';

const FILTER_TABS = [
  { id: 'ALL', label: '全部' },
  { id: 'Control Kit', label: 'Control Kit' },
  { id: 'Remote', label: 'Remote' },
  { id: 'Receiver', label: 'Receiver' }
];

export default function FccProductList({ products, loading, error, onRemove, baseUrl = '' }) {
  const [activeType, setActiveType] = useState('ALL');
  const safeProducts = useMemo(() => (Array.isArray(products) ? products : []), [products]);

  const counts = useMemo(() => {
    const map = { ALL: safeProducts.length, 'Control Kit': 0, Remote: 0, Receiver: 0 };
    safeProducts.forEach((p) => {
      const normalized = (p.productType || '').trim().toLowerCase();
      if (normalized === 'control kit') map['Control Kit'] += 1;
      else if (normalized === 'remote') map.Remote += 1;
      else if (normalized === 'receiver') map.Receiver += 1;
    });
    return map;
  }, [safeProducts]);

  const displayedProducts = useMemo(() => {
    if (activeType === 'ALL') return safeProducts;
    const target = activeType.toLowerCase();
    return safeProducts.filter((p) => (p.productType || '').trim().toLowerCase() === target);
  }, [safeProducts, activeType]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-7 w-7 border-2 border-indigo-600 border-t-transparent" />
        <span className="ml-3 text-sm text-slate-500">加载关联控制器中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-rose-600">数据加载失败：{error}</p>
      </div>
    );
  }

  if (safeProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          <Package className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800 mb-1">暂无关联控制器</h3>
        <p className="text-xs text-slate-500">
          请在左侧从 Control Kit、Remote、Receiver 中选择并点击“关联控制器”进行绑定
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-slate-900">
          已关联控制器
          <span className="ml-2 text-xs font-normal text-slate-500 tabular-nums">
            共 {safeProducts.length} 款
          </span>
        </h3>

        <div
          role="tablist"
          aria-label="已关联控制器分类筛选"
          className="flex items-center gap-1 border-b border-slate-200 sm:border-b-0"
        >
          {FILTER_TABS.map((tab) => {
            const isActive = activeType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveType(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap tabular-nums ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                {tab.label}
                <span className={`ml-1 text-[11px] ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                  {counts[tab.id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {displayedProducts.length === 0 ? (
        <div className="border border-slate-200 rounded-lg py-10 text-center text-xs text-slate-400">
          当前分类暂无已关联的 {activeType}
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">
                  型号 / SKU
                </th>
                <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">
                  控制器类型
                </th>
                <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">
                  图片
                </th>
                <th scope="col" className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {displayedProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">{product.model || '—'}</div>
                    {product.sku && (
                      <div className="text-[11px] font-mono text-slate-400 tabular-nums mt-0.5">
                        SKU: {product.sku}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs font-medium text-slate-700">
                    {product.productType || '—'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <div className="w-12 h-12 aspect-square rounded-md border border-slate-200 bg-slate-50 overflow-hidden">
                      <MediaThumb
                        src={formatMediaUrl(product.image, baseUrl)}
                        alt={product.model || '控制器图片'}
                        className="w-full h-full aspect-square object-cover"
                        fallbackText="无图"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                    <button
                      type="button"
                      onClick={() => onRemove(product.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-600 bg-white border border-rose-200 rounded-md hover:bg-rose-50 transition-colors whitespace-nowrap"
                    >
                      <Trash2 className="w-3 h-3" />
                      移除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
