import React from 'react';
import { Trash2, Package } from 'lucide-react';

export default function FccProductList({ products, loading, error, onRemove }) {
  const safeProducts = Array.isArray(products) ? products : [];

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-7 w-7 border-2 border-indigo-600 border-t-transparent" />
        <span className="ml-3 text-sm text-slate-500">加载关联产品中...</span>
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
        <h3 className="text-sm font-semibold text-slate-800 mb-1">暂无关联产品</h3>
        <p className="text-xs text-slate-500">
          请在左侧选择产品并点击“关联产品”进行绑定
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900">
          已关联产品
          <span className="ml-2 text-xs font-normal text-slate-500 tabular-nums">
            共 {safeProducts.length} 个
          </span>
        </h3>
      </div>
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">
                产品型号
              </th>
              <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">
                品牌
              </th>
              <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">
                描述
              </th>
              <th scope="col" className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {safeProducts.map((product) => (
              <tr key={product.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-slate-900">
                  {product.model}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-sm text-slate-600">
                  {product.brand || '—'}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xs">
                  <div className="line-clamp-2">
                    {product.description || '—'}
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
    </div>
  );
}
