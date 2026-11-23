// src/components/AddProductToFccForm.jsx
import React, { useState } from 'react';
import { Link2 } from 'lucide-react';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { showAppToast } from './CatalogUI';

export default function AddProductToFccForm({
  fccId,
  onAdd,
  filteredAvailableProducts = []
}) {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [associateLoading, setAssociateLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAssociateProduct = async () => {
    if (!selectedProductId) {
      setError('请先选择要关联的产品');
      return;
    }

    setAssociateLoading(true);
    setError('');
    try {
      const response = await fetchWithAuth(`/api/fccs/${fccId}/products`, {
        method: 'POST',
        body: JSON.stringify({ productId: selectedProductId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.code === 'ALREADY_ASSOCIATED') {
          setError('该产品已关联，不能重复添加');
        } else {
          setError(errorData.message || '关联失败，请稍后重试');
        }
        return;
      }

      if (onAdd) onAdd();
      setSelectedProductId('');
      showAppToast('产品关联成功', 'success');
    } catch (err) {
      setError(err.message || '关联失败，请稍后重试');
    } finally {
      setAssociateLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">关联新产品</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          从现有产品库中选择并绑定到当前 FCC ID
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          选择产品
        </label>
        <select
          value={selectedProductId}
          onChange={(e) => {
            setSelectedProductId(e.target.value);
            if (error) setError('');
          }}
          className="w-full h-10 px-3 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="">-- 请选择产品 --</option>
          {filteredAvailableProducts.map((product) => (
            <option key={product.id} value={product.id}>
              {product.model} {product.sku ? `(${product.sku})` : ''} - {product.brand || '无品牌'}
            </option>
          ))}
        </select>
        {filteredAvailableProducts.length === 0 && (
          <p className="text-xs text-slate-400 mt-1.5">暂无更多可关联的产品</p>
        )}
      </div>

      <button
        type="button"
        onClick={handleAssociateProduct}
        disabled={!selectedProductId || associateLoading}
        className="w-full inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed whitespace-nowrap"
      >
        <Link2 className="w-4 h-4" />
        {associateLoading ? '关联中...' : '关联产品'}
      </button>
    </div>
  );
}
