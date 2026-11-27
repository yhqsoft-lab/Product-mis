// src/components/ProductRelationsManager.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Plus,
  Search,
  Check,
  Trash2,
  Package,
  AlertCircle,
  RotateCw
} from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { formatMediaUrl, MediaThumb, showAppToast } from './CatalogUI';

const RELATION_TYPES = [
  {
    id: 'compatible',
    label: '互匹配',
    directionHint: '双向',
    fullName: '互匹配产品',
    textClass: 'text-emerald-700',
    activeTabClass: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    selectClass: 'text-emerald-700 border-emerald-200 bg-emerald-50/50'
  },
  {
    id: 'mutual_replacement',
    label: '互替代',
    directionHint: '双向',
    fullName: '互替代产品',
    textClass: 'text-sky-700',
    activeTabClass: 'bg-sky-50 text-sky-700 border-sky-300',
    selectClass: 'text-sky-700 border-sky-200 bg-sky-50/50'
  },
  {
    id: 'replacement',
    label: '可替代',
    directionHint: '单向',
    fullName: '可替代产品',
    textClass: 'text-amber-700',
    activeTabClass: 'bg-amber-50 text-amber-700 border-amber-300',
    selectClass: 'text-amber-700 border-amber-200 bg-amber-50/50'
  },
  {
    id: 'upgrade',
    label: '升级款',
    directionHint: '单向',
    fullName: '升级款产品',
    textClass: 'text-indigo-700',
    activeTabClass: 'bg-indigo-50 text-indigo-700 border-indigo-300',
    selectClass: 'text-indigo-700 border-indigo-200 bg-indigo-50/50'
  }
];

const parseRelationsData = (rawData) => {
  const source = rawData?.success && rawData?.data ? rawData.data : rawData || {};
  const compatibleData = Array.isArray(source.compatible) ? source.compatible : [];
  const mutualReplacementData = Array.isArray(source.mutualReplacement)
    ? source.mutualReplacement
    : Array.isArray(source.mutual_replacement)
      ? source.mutual_replacement
      : [];
  const replacementData = Array.isArray(source.replacement) ? source.replacement : [];
  const upgradeData = Array.isArray(source.upgrade) ? source.upgrade : [];

  const seenIds = new Set();
  const result = [];

  const append = (list, relationType) => {
    list.forEach((item) => {
      if (item && item.id != null && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        result.push({ targetProduct: item, relationType });
      }
    });
  };

  append(compatibleData, 'compatible');
  append(mutualReplacementData, 'mutual_replacement');
  append(replacementData, 'replacement');
  append(upgradeData, 'upgrade');

  return result;
};

const serializeRelations = (list) =>
  list
    .map((r) => `${r.targetProduct.id}:${r.relationType}`)
    .sort()
    .join('|');

const getRawImage = (item) => {
  if (!item) return null;
  if (item.imageUrl) return item.imageUrl;
  if (Array.isArray(item.images) && item.images.length > 0) return item.images[0];
  if (typeof item.image === 'string') return item.image;
  return null;
};

const ProductRelationsManager = ({
  product,
  onClose,
  onSave,
  apiUrl = '/api/products'
}) => {
  const rawApiBase = process.env.REACT_APP_API_BASE || '';
  const BASE_URL = /^https?:\/\//i.test(rawApiBase) ? rawApiBase.replace(/\/+$/, '') : '';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  const [availableProducts, setAvailableProducts] = useState([]);
  const [relations, setRelations] = useState([]);
  const [savedSnapshot, setSavedSnapshot] = useState('');

  // 左侧选择状态
  const [selectedRelationType, setSelectedRelationType] = useState('compatible');
  const [pickerSearch, setPickerSearch] = useState('');

  // 右侧筛选状态
  const [activeFilter, setActiveFilter] = useState('all');

  const fetchData = useCallback(async () => {
    if (!product?.id) return;
    setLoading(true);
    setLoadError('');
    setActionError('');

    try {
      const [productsRes, relationsRes] = await Promise.all([
        apiClient(`${apiUrl}`),
        apiClient(`${apiUrl}/${product.id}/relations`)
      ]);

      if (!productsRes.ok) {
        const err = await productsRes.json().catch(() => ({}));
        throw new Error(err.message || `获取产品列表失败 (HTTP ${productsRes.status})`);
      }
      if (!relationsRes.ok) {
        const err = await relationsRes.json().catch(() => ({}));
        throw new Error(err.message || `获取产品关系失败 (HTTP ${relationsRes.status})`);
      }

      const allProducts = await productsRes.json();
      const rawRelations = await relationsRes.json();

      const candidates = Array.isArray(allProducts)
        ? allProducts.filter((p) => Number(p.id) !== Number(product.id))
        : [];
      const parsedRelations = parseRelationsData(rawRelations);

      setAvailableProducts(candidates);
      setRelations(parsedRelations);
      setSavedSnapshot(serializeRelations(parsedRelations));
    } catch (err) {
      console.error('获取产品关系数据失败:', err);
      setLoadError(err.message || '加载关系数据失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [product?.id, apiUrl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Esc 关闭模态框
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, saving]);

  // 是否有未保存的改动
  const hasChanges = useMemo(
    () => serializeRelations(relations) !== savedSnapshot,
    [relations, savedSnapshot]
  );

  // 未关联的可选产品（支持关键词搜索）
  const unlinkedProducts = useMemo(() => {
    const relatedIds = new Set(relations.map((r) => Number(r.targetProduct.id)));
    const keyword = pickerSearch.trim().toLowerCase();

    return availableProducts.filter((p) => {
      if (relatedIds.has(Number(p.id))) return false;
      if (!keyword) return true;
      return (
        String(p.model || '').toLowerCase().includes(keyword) ||
        String(p.sku || '').toLowerCase().includes(keyword) ||
        String(p.brand || '').toLowerCase().includes(keyword) ||
        String(p.productType || '').toLowerCase().includes(keyword)
      );
    });
  }, [availableProducts, relations, pickerSearch]);

  // 分类计数
  const counts = useMemo(() => {
    const map = { compatible: 0, mutual_replacement: 0, replacement: 0, upgrade: 0 };
    relations.forEach((r) => {
      if (map[r.relationType] !== undefined) {
        map[r.relationType] += 1;
      }
    });
    return map;
  }, [relations]);

  // 当前筛选后的已关联列表
  const visibleRelations = useMemo(() => {
    if (activeFilter === 'all') return relations;
    return relations.filter((r) => r.relationType === activeFilter);
  }, [relations, activeFilter]);

  // 添加单个关联（按产品 ID 去重，防止重复）
  const addProductRelation = (targetProduct) => {
    if (!targetProduct || !selectedRelationType) return;
    setActionError('');

    const exists = relations.some((r) => Number(r.targetProduct.id) === Number(targetProduct.id));
    if (exists) {
      setActionError('该产品已在关联列表中，可直接修改其关系类型。');
      return;
    }

    setRelations((prev) => [
      { targetProduct, relationType: selectedRelationType },
      ...prev
    ]);
  };

  // 修改已有项的关系类型
  const changeRelationType = (targetProductId, nextType) => {
    setRelations((prev) =>
      prev.map((r) =>
        Number(r.targetProduct.id) === Number(targetProductId)
          ? { ...r, relationType: nextType }
          : r
      )
    );
  };

  // 按目标产品 ID 移除（修复筛选状态下按数组下标误删的问题）
  const removeRelation = (targetProductId) => {
    setRelations((prev) =>
      prev.filter((r) => Number(r.targetProduct.id) !== Number(targetProductId))
    );
  };

  // 保存全部关系
  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setActionError('');

    try {
      const seenIds = new Set([Number(product.id)]);
      const compatible = [];
      const upgrade = [];
      const mutualReplacement = [];
      const replacement = [];

      relations.forEach((rel) => {
        const pid = Number(rel.targetProduct?.id);
        if (!Number.isInteger(pid) || pid <= 0 || seenIds.has(pid)) return;
        seenIds.add(pid);

        if (rel.relationType === 'compatible') compatible.push(pid);
        else if (rel.relationType === 'upgrade') upgrade.push(pid);
        else if (rel.relationType === 'mutual_replacement') mutualReplacement.push(pid);
        else if (rel.relationType === 'replacement') replacement.push(pid);
      });

      const res = await apiClient(`${apiUrl}/${product.id}/relations`, {
        method: 'PUT',
        body: JSON.stringify({ compatible, upgrade, mutualReplacement, replacement })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `保存失败 (HTTP ${res.status})`);
      }

      // 以服务端最新数据为准同步状态
      const updatedRes = await apiClient(`${apiUrl}/${product.id}/relations`);
      if (updatedRes.ok) {
        const updatedRaw = await updatedRes.json();
        const synced = parseRelationsData(updatedRaw);
        setRelations(synced);
        setSavedSnapshot(serializeRelations(synced));
      } else {
        setSavedSnapshot(serializeRelations(relations));
      }

      if (onSave) onSave();
      showAppToast('产品关系已保存（互匹配/互替代已双向同步）', 'success');
    } catch (err) {
      console.error('保存产品关系失败:', err);
      setActionError(err.message || '保存失败，请稍后重试');
      showAppToast(`保存失败：${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const activeTypeMeta = RELATION_TYPES.find((t) => t.id === selectedRelationType) || RELATION_TYPES[0];

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="产品关系管理"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-5xl max-h-[88vh] overflow-hidden flex flex-col shadow-xl">
        {/* 顶部标题栏 */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 aspect-square rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0">
              <MediaThumb
                src={formatMediaUrl(getRawImage(product), BASE_URL)}
                alt={product?.model || '产品'}
                fallbackText="无图"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-semibold text-slate-900 truncate">
                  产品关系管理
                </h2>
                {hasChanges && (
                  <span className="text-xs font-medium text-amber-600 whitespace-nowrap">
                    · 有未保存更改
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                <span className="font-medium text-slate-700">{product?.model || '未命名型号'}</span>
                {product?.sku && (
                  <>
                    <span aria-hidden="true" className="mx-1.5 text-slate-300">·</span>
                    <span className="font-mono tabular-nums">SKU: {product.sku}</span>
                  </>
                )}
                {product?.brand && (
                  <>
                    <span aria-hidden="true" className="mx-1.5 text-slate-300">·</span>
                    <span>{product.brand}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="关闭"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors shrink-0 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 主体内容区 */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 bg-slate-50/40">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent mb-3" />
            <p className="text-sm text-slate-500">正在加载产品关系数据...</p>
          </div>
        ) : loadError ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 px-6 text-center bg-slate-50/40">
            <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-900 mb-1">加载失败</p>
            <p className="text-xs text-rose-600 mb-4 max-w-md">{loadError}</p>
            <button
              type="button"
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <RotateCw className="w-4 h-4" />
              重新加载
            </button>
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 overflow-y-auto md:overflow-hidden">
            {/* 左侧：选择关系类型 + 搜索添加产品 */}
            <div className="md:col-span-5 p-5 border-b md:border-b-0 md:border-r border-slate-200 bg-white flex flex-col min-h-0">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-900">添加关联产品</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  先选择关联类型，再从下方点击添加产品
                </p>
              </div>

              {actionError && (
                <div className="mb-3 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between gap-2 text-xs text-rose-700">
                  <span>{actionError}</span>
                  <button
                    type="button"
                    onClick={() => setActionError('')}
                    aria-label="关闭提示"
                    className="text-rose-400 hover:text-rose-600 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* 关系类型分段选择 */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  关联类型
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg">
                  {RELATION_TYPES.map((type) => {
                    const active = selectedRelationType === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setSelectedRelationType(type.id)}
                        className={`py-1.5 px-2 text-xs font-medium rounded-md transition-all whitespace-nowrap flex items-center justify-center gap-1 ${
                          active
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>{type.label}</span>
                        <span className="text-[10px] font-normal text-slate-400">
                          {type.directionHint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 搜索可选产品 */}
              <div className="relative mb-3">
                <Search
                  aria-hidden="true"
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="搜索型号、SKU 或品牌..."
                  className="w-full h-9 pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
                {pickerSearch && (
                  <button
                    type="button"
                    onClick={() => setPickerSearch('')}
                    aria-label="清空筛选"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* 可选产品列表 */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 px-0.5 tabular-nums">
                <span>可选产品</span>
                <span>剩余 {unlinkedProducts.length} 个</span>
              </div>

              <div className="flex-1 min-h-[220px] md:min-h-0 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                {unlinkedProducts.length === 0 ? (
                  <div className="py-12 px-4 text-center">
                    <p className="text-xs text-slate-500">
                      {pickerSearch ? '未找到匹配的可选产品' : '所有产品均已添加关联'}
                    </p>
                  </div>
                ) : (
                  unlinkedProducts.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="p-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-10 h-10 aspect-square rounded-md border border-slate-100 bg-slate-50 overflow-hidden shrink-0">
                        <MediaThumb
                          src={formatMediaUrl(getRawImage(candidate), BASE_URL)}
                          alt={candidate.model || '产品'}
                          fallbackText=""
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900 truncate" title={candidate.model || ''}>
                          {candidate.model || '未命名型号'}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          <span className="font-mono tabular-nums">{candidate.sku || '无 SKU'}</span>
                          <span aria-hidden="true" className="mx-1 text-slate-300">·</span>
                          <span>{candidate.brand || '无品牌'}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addProductRelation(candidate)}
                        title={`添加为${activeTypeMeta.fullName}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50/70 hover:bg-indigo-600 hover:text-white rounded-md transition-colors whitespace-nowrap shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        添加
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 右侧：已关联产品列表与分类切换 */}
            <div className="md:col-span-7 p-5 bg-slate-50/50 flex flex-col min-h-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-4">
                <h3 className="text-sm font-semibold text-slate-900 tabular-nums">
                  已选关联
                  <span className="ml-1.5 text-xs font-normal text-slate-500">
                    共 {relations.length} 个
                  </span>
                </h3>

                {/* 交互式分类筛选器 */}
                <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap tabular-nums ${
                      activeFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    全部 {relations.length}
                  </button>
                  {RELATION_TYPES.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setActiveFilter(type.id)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap tabular-nums ${
                        activeFilter === type.id
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {type.label} {counts[type.id]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 min-h-[240px] md:min-h-0 overflow-y-auto space-y-2.5 pr-0.5">
                {visibleRelations.length === 0 ? (
                  <div className="h-full min-h-[220px] bg-white border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center px-6 py-10">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                      <Package className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">
                      {relations.length === 0 ? '尚未添加任何关联产品' : '当前分类下暂无关联产品'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      从左侧产品列表中点击“添加”即可建立关联
                    </p>
                  </div>
                ) : (
                  visibleRelations.map((relation) => {
                    const target = relation.targetProduct;
                    const typeMeta =
                      RELATION_TYPES.find((t) => t.id === relation.relationType) || RELATION_TYPES[0];

                    return (
                      <div
                        key={target.id}
                        className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3.5 hover:border-slate-300 transition-colors"
                      >
                        <div className="w-12 h-12 aspect-square rounded-lg border border-slate-100 bg-slate-50 overflow-hidden shrink-0">
                          <MediaThumb
                            src={formatMediaUrl(getRawImage(target), BASE_URL)}
                            alt={target.model || '产品'}
                            fallbackText=""
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate" title={target.model || ''}>
                            {target.model || '未命名型号'}
                          </p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            <span className="font-mono tabular-nums">SKU: {target.sku || '—'}</span>
                            <span aria-hidden="true" className="mx-1.5 text-slate-300">·</span>
                            <span>{target.brand || '无品牌'}</span>
                            {target.productType ? (
                              <>
                                <span aria-hidden="true" className="mx-1.5 text-slate-300">·</span>
                                <span>{target.productType}</span>
                              </>
                            ) : null}
                          </p>
                        </div>

                        {/* 直接行内切换关系类型 */}
                        <select
                          value={relation.relationType}
                          onChange={(e) => changeRelationType(target.id, e.target.value)}
                          aria-label={`修改 ${target.model || '产品'} 的关系类型`}
                          className={`h-8 px-2 text-xs font-medium border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shrink-0 ${typeMeta.selectClass}`}
                        >
                          {RELATION_TYPES.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.label}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => removeRelation(target.id)}
                          title="移除关联"
                          aria-label={`移除 ${target.model || '产品'}`}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* 底部统计与保存操作栏 */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 tabular-nums flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>共 {relations.length} 个关联</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-emerald-700">互匹配 {counts.compatible}</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-sky-700">互替代 {counts.mutual_replacement}</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-amber-700">可替代 {counts.replacement}</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-indigo-700">升级款 {counts.upgrade}</span>
            <span aria-hidden="true" className="hidden sm:inline text-slate-300">·</span>
            <span className="text-slate-400">互匹配/互替代双向同步</span>
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap disabled:opacity-50"
            >
              {hasChanges ? '取消' : '关闭'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading || !!loadError || !hasChanges}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  保存中...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  保存关系
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductRelationsManager;
