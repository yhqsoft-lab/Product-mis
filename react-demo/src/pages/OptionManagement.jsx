// src/pages/OptionManagement.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';
import { useUser } from '../context/useUser';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { useFooterRight } from '../components/DashboardLayout';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  PageToolbar,
  EmptyState,
  ErrorState,
  showAppToast,
  PaginationBar
} from '../components/CatalogUI';

const DEFAULT_PAGE_SIZE = 20;

const CATEGORY_TABS = [
  { key: 'all', label: '全部分类' },
  { key: 'brand', label: '品牌 (Brand)' },
  { key: 'productType', label: '产品类型' },
  { key: 'speed', label: 'AC/DC 规格' },
  { key: 'status', label: '销售状态' },
  { key: 'role', label: '账号角色' }
];

const CREATABLE_CATEGORIES = CATEGORY_TABS.filter(
  (c) => c.key !== 'all' && c.key !== 'role'
);

const CATEGORY_META = {
  brand: { label: '品牌', badgeClass: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  productType: { label: '产品类型', badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  speed: { label: 'AC/DC 规格', badgeClass: 'text-amber-700 bg-amber-50 border-amber-200' },
  status: { label: '销售状态', badgeClass: 'text-sky-700 bg-sky-50 border-sky-200' },
  role: { label: '账号角色', badgeClass: 'text-slate-700 bg-slate-100 border-slate-200' }
};

export default function OptionManagement() {
  const { user, token, loading: isUserLoading } = useUser();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';

  const [items, setItems] = useState([]);
  const [category, setCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  // 新增 / 编辑弹窗
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formState, setFormState] = useState({
    category: 'brand',
    value: '',
    label: '',
    description: '',
    sortOrder: 10,
    isActive: true
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 删除确认框
  const [deleteTarget, setDeleteTarget] = useState(null);

  useFooterRight(
    pagination.total > 0
      ? `第 ${pagination.page} / ${Math.max(1, pagination.totalPages)} 页 · 共 ${pagination.total} 个选项`
      : ''
  );

  useEffect(() => {
    if (isUserLoading) return;
    if (!user && !token) {
      navigate('/login', { replace: true });
      return;
    }
    if (user && user.role !== 'admin' && user.role !== 'editor') {
      navigate('/productview', { replace: true });
    }
  }, [user, token, isUserLoading, navigate]);

  const fetchOptionsList = useCallback(
    async (cat = 'all', search = '', targetPage = 1, targetPageSize = DEFAULT_PAGE_SIZE) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(targetPageSize)
        });
        if (cat && cat !== 'all') {
          params.set('category', cat);
        }
        if (search.trim()) {
          params.set('search', search.trim());
        }

        const res = await fetchWithAuth(`/api/options/manage?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 401) {
            navigate('/login', { replace: true });
            return;
          }
          throw new Error(data.message || `获取选项列表失败 (${res.status})`);
        }

        const rows = Array.isArray(data.data) ? data.data : [];
        const nextPagination = data.pagination || {
          page: 1,
          pageSize: targetPageSize,
          total: rows.length,
          totalPages: rows.length > 0 ? 1 : 0
        };
        setItems(rows);
        setPagination(nextPagination);
        if (nextPagination.page && nextPagination.page !== targetPage) {
          setPage(nextPagination.page);
        }
      } catch (err) {
        setError(err.message || '获取选项列表失败');
        setItems([]);
        setPagination({ page: 1, pageSize: targetPageSize, total: 0, totalPages: 0 });
      } finally {
        setLoading(false);
        setSearching(false);
      }
    },
    [navigate]
  );

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
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm, activeSearch]);

  useEffect(() => {
    if (isUserLoading || (!user && !token)) return;
    if (user && user.role !== 'admin' && user.role !== 'editor') return;
    fetchOptionsList(category, activeSearch, page, pageSize);
  }, [isUserLoading, user, token, category, activeSearch, page, pageSize, fetchOptionsList]);

  const handleCategoryChange = (nextCategory) => {
    setCategory(nextCategory);
    setPage(1);
  };

  const handlePageSizeChange = (nextSize) => {
    setPageSize(nextSize);
    setPage(1);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setActiveSearch('');
    setPage(1);
    setSearching(false);
  };

  const handleSyncFromDb = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetchWithAuth('/api/options/sync', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || '同步失败');
      }
      showAppToast(data.message || '同步完成', 'success');
      fetchOptionsList(category, activeSearch, page, pageSize);
    } catch (err) {
      showAppToast(`同步失败：${err.message}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const openCreateModal = () => {
    const defaultCategory =
      category !== 'all' && category !== 'role' ? category : 'brand';
    setEditingItem(null);
    setFormState({
      category: defaultCategory,
      value: '',
      label: '',
      description: '',
      sortOrder: 50,
      isActive: true
    });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormState({
      category: item.category,
      value: item.value || '',
      label: item.label || '',
      description: item.description || '',
      sortOrder: Number.isInteger(Number(item.sortOrder)) ? Number(item.sortOrder) : 0,
      isActive: item.isActive !== false
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setShowModal(false);
    setEditingItem(null);
    setFormError('');
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const trimmedValue = formState.value.trim();
    const trimmedLabel = (formState.label.trim() || trimmedValue);

    if (!trimmedValue) {
      setFormError('选项值不能为空');
      return;
    }

    setSubmitting(true);
    try {
      const isEditing = Boolean(editingItem);
      const url = isEditing ? `/api/options/${editingItem.id}` : '/api/options';
      const method = isEditing ? 'PUT' : 'POST';
      const payload = isEditing
        ? {
            value: trimmedValue,
            label: trimmedLabel,
            description: formState.description.trim(),
            sortOrder: Number.parseInt(formState.sortOrder, 10) || 0,
            isActive: formState.isActive
          }
        : {
            category: formState.category,
            value: trimmedValue,
            label: trimmedLabel,
            description: formState.description.trim(),
            sortOrder: Number.parseInt(formState.sortOrder, 10) || 0,
            isActive: formState.isActive
          };

      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || '保存失败');
      }

      showAppToast(isEditing ? '选项已更新' : '新选项已添加到数据库', 'success');
      setShowModal(false);
      setEditingItem(null);
      fetchOptionsList(category, activeSearch, page, pageSize);
    } catch (err) {
      setFormError(err.message || '操作失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetchWithAuth(`/api/options/${deleteTarget.id}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || '删除失败');
      }
      showAppToast(`已删除选项「${deleteTarget.label}」`, 'success');
      setDeleteTarget(null);
      fetchOptionsList(category, activeSearch, page, pageSize);
    } catch (err) {
      showAppToast(`删除失败：${err.message}`, 'error');
      setDeleteTarget(null);
    }
  };

  const isLockedRole = editingItem?.category === 'role';

  const subtitleText = activeSearch && !loading
    ? `搜索 "${activeSearch}" · 共 ${pagination.total} 个选项`
    : loading
      ? '正在加载数据库选项...'
      : `共 ${pagination.total} 个选项 · 统一管理存储在数据库中的下拉选项`;

  return (
    <div>
      <PageToolbar
        title="下拉选项管理"
        subtitle={subtitleText}
        searchTerm={searchTerm}
        onSearchChange={(e) => setSearchTerm(e.target.value)}
        onClearSearch={clearSearch}
        searchPlaceholder="搜索选项值、显示名称或说明..."
        searching={searching}
        loading={loading}
        actionButton={
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSyncFromDb}
              disabled={syncing || loading}
              title="扫描产品与 FCC 表中已有字段并补充到选项表"
              className="inline-flex items-center justify-center gap-1.5 h-10 px-3.5 bg-white text-slate-700 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors whitespace-nowrap disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>从现有数据同步</span>
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>新增选项</span>
            </button>
          </div>
        }
      />

      {/* 分类筛选标签 */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 mb-5 flex items-center gap-1.5 overflow-x-auto">
        {CATEGORY_TABS.map((tab) => {
          const active = category === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleCategoryChange(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 选项列表 */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 flex items-center justify-center gap-3 text-sm text-slate-500">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent" />
          正在加载选项数据...
        </div>
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => fetchOptionsList(category, activeSearch, page, pageSize)}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={activeSearch ? '未找到匹配选项' : '当前分类暂无选项'}
          description={
            activeSearch
              ? `没有匹配 "${activeSearch}" 的下拉选项记录。`
              : '点击右上角“新增选项”或“从现有数据同步”维护下拉选项。'
          }
          actionLabel={activeSearch ? '清除搜索' : '新增选项'}
          onAction={activeSearch ? clearSearch : openCreateModal}
        />
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                      所属分类
                    </th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                      显示名称 (Label)
                    </th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                      存储值 (Value)
                    </th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                      排序
                    </th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                      状态
                    </th>
                    <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-slate-500">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.map((item) => {
                    const catMeta = CATEGORY_META[item.category] || {
                      label: item.category,
                      badgeClass: 'text-slate-600 bg-slate-100 border-slate-200'
                    };
                    const isRole = item.category === 'role';
                    const isActive = item.isActive !== false;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium border rounded-md ${catMeta.badgeClass}`}
                          >
                            {catMeta.label}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="text-sm font-medium text-slate-900">{item.label}</div>
                          {item.description && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">
                              {item.description}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {item.value}
                          </span>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-xs text-slate-500 tabular-nums">
                          {item.sortOrder ?? 0}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-xs font-medium">
                          {isActive ? (
                            <span className="text-emerald-600">启用</span>
                          ) : (
                            <span className="text-slate-400">停用</span>
                          )}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-white border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors whitespace-nowrap"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              编辑
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                disabled={isRole}
                                onClick={() => setDeleteTarget(item)}
                                title={isRole ? '系统角色不可删除' : '删除选项'}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-600 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                删除
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <PaginationBar
            page={pagination.page}
            pageSize={pageSize}
            total={pagination.total}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
            pageSizeOptions={[10, 20, 50]}
            loading={loading}
            itemLabel="个选项"
          />
        </>
      )}

      {/* 新增 / 编辑选项弹窗 */}
      {showModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  {editingItem ? '编辑下拉选项' : '新增下拉选项'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="关闭"
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  所属分类 <span className="text-rose-500">*</span>
                </label>
                {editingItem ? (
                  <p className="h-10 px-3 flex items-center text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg">
                    {CATEGORY_META[editingItem.category]?.label || editingItem.category}
                  </p>
                ) : (
                  <select
                    value={formState.category}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, category: e.target.value }))
                    }
                    disabled={submitting}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {CREATABLE_CATEGORIES.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  选项存储值 (Value) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formState.value}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setFormState((prev) => ({
                      ...prev,
                      value: nextVal,
                      label: !editingItem && (!prev.label || prev.label === prev.value)
                        ? nextVal
                        : prev.label
                    }));
                  }}
                  disabled={submitting || isLockedRole}
                  placeholder="例如: Hunter / DC 6-speeds"
                  className="w-full h-10 px-3 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  下拉显示名称 (Label) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formState.label}
                  onChange={(e) => setFormState((prev) => ({ ...prev, label: e.target.value }))}
                  disabled={submitting}
                  placeholder="默认与存储值一致，也可填中文名称"
                  className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  说明（可选）
                </label>
                <input
                  type="text"
                  value={formState.description}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, description: e.target.value }))
                  }
                  disabled={submitting}
                  placeholder="可选备注说明"
                  className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    排序（越小越靠前）
                  </label>
                  <input
                    type="number"
                    value={formState.sortOrder}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, sortOrder: e.target.value }))
                    }
                    disabled={submitting}
                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 tabular-nums"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs font-medium text-slate-700 cursor-pointer">
                    <span>启用状态</span>
                    <input
                      type="checkbox"
                      checked={formState.isActive}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, isActive: e.target.checked }))
                      }
                      disabled={submitting || isLockedRole}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="h-9 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-9 px-4 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? '保存中...' : editingItem ? '保存修改' : '添加选项'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 删除确认框 */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="删除下拉选项"
        message={
          deleteTarget
            ? `确定要删除选项「${deleteTarget.label}」吗？已保存的产品或 FCC 历史数据不会受影响。`
            : ''
        }
        confirmText="确认删除"
        cancelText="取消"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isDanger={true}
      />
    </div>
  );
}
