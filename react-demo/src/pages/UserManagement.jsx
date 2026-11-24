// src/pages/UserManagement.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Pencil,
  KeyRound,
  Trash2,
  X,
  Shield,
  Users
} from 'lucide-react';
import { useUser } from '../context/useUser';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { useFooterRight } from '../components/DashboardLayout';
import { useDropdownOptions } from '../hooks/useDropdownOptions';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  PageToolbar,
  EmptyState,
  ErrorState,
  showAppToast,
  PaginationBar
} from '../components/CatalogUI';

const DEFAULT_PAGE_SIZE = 10;

const getRoleMeta = (role, roleOptions = []) => {
  const matched = roleOptions.find((r) => r.value === role);
  const label = matched?.shortLabel || matched?.label || role;
  if (role === 'admin') {
    return { label, className: 'text-indigo-700 bg-indigo-50 border-indigo-200' };
  }
  if (role === 'editor') {
    return { label, className: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  }
  return { label, className: 'text-slate-600 bg-slate-100 border-slate-200' };
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function UserManagement() {
  const { user: currentUser, token, loading: isUserLoading } = useUser();
  const navigate = useNavigate();
  const { options: dbOptions } = useDropdownOptions();

  const roleOptions = useMemo(
    () =>
      dbOptions.role.map((o) => ({
        value: o.value,
        shortLabel: o.label || o.value,
        label: `${o.label || o.value} (${o.value})`,
        desc: o.description || ''
      })),
    [dbOptions.role]
  );

  const [users, setUsers] = useState([]);
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
  const [error, setError] = useState(null);

  // 新增 / 编辑账号弹窗
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formState, setFormState] = useState({
    username: '',
    email: '',
    password: '',
    role: 'editor',
    isActive: true
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 重置密码弹窗
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPasswords, setResetPasswords] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [resetError, setResetError] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // 删除确认弹窗
  const [deleteTarget, setDeleteTarget] = useState(null);

  useFooterRight(
    pagination.total > 0
      ? `第 ${pagination.page} / ${Math.max(1, pagination.totalPages)} 页 · 共 ${pagination.total} 个账号`
      : ''
  );

  useEffect(() => {
    if (isUserLoading) return;
    if (!currentUser && !token) {
      navigate('/login', { replace: true });
      return;
    }
    if (currentUser && currentUser.role !== 'admin') {
      navigate(currentUser.role === 'editor' ? '/products' : '/productview', { replace: true });
    }
  }, [currentUser, token, isUserLoading, navigate]);

  const fetchUsers = useCallback(async (search = '', targetPage = 1, targetPageSize = DEFAULT_PAGE_SIZE) => {
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
      const res = await fetchWithAuth(`/api/auth/users?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        throw new Error(data.message || `获取账号列表失败 (${res.status})`);
      }
      const items = Array.isArray(data.data) ? data.data : [];
      const nextPagination = data.pagination || {
        page: 1,
        pageSize: targetPageSize,
        total: items.length,
        totalPages: items.length > 0 ? Math.ceil(items.length / targetPageSize) : 0
      };
      setUsers(items);
      setPagination(nextPagination);
      if (nextPagination.page && nextPagination.page !== targetPage) {
        setPage(nextPagination.page);
      }
    } catch (err) {
      setError(err.message || '获取账号列表失败');
      setUsers([]);
      setPagination({ page: 1, pageSize: targetPageSize, total: 0, totalPages: 0 });
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, [navigate]);

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
    if (isUserLoading || !currentUser || currentUser.role !== 'admin') return;
    fetchUsers(activeSearch, page, pageSize);
  }, [isUserLoading, currentUser, activeSearch, page, pageSize, fetchUsers]);

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

  const openCreateModal = () => {
    setEditingUser(null);
    setFormState({
      username: '',
      email: '',
      password: '',
      role: 'editor',
      isActive: true
    });
    setFormError('');
    setShowFormModal(true);
  };

  const openEditModal = (target) => {
    setEditingUser(target);
    setFormState({
      username: target.username || '',
      email: target.email || '',
      password: '',
      role: target.role || 'user',
      isActive: target.isActive !== false
    });
    setFormError('');
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    if (submitting) return;
    setShowFormModal(false);
    setEditingUser(null);
    setFormError('');
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!editingUser) {
      if (!formState.username.trim() || formState.username.trim().length < 3) {
        setFormError('用户名长度至少为 3 个字符');
        return;
      }
      if (!formState.password || formState.password.length < 6) {
        setFormError('初始密码长度至少为 6 位');
        return;
      }
    }

    setSubmitting(true);
    try {
      const url = editingUser
        ? `/api/auth/users/${editingUser.id}`
        : '/api/auth/users';
      const method = editingUser ? 'PUT' : 'POST';
      const payload = editingUser
        ? {
            role: formState.role,
            isActive: formState.isActive,
            email: formState.email.trim()
          }
        : {
            username: formState.username.trim(),
            password: formState.password,
            email: formState.email.trim(),
            role: formState.role,
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

      showAppToast(editingUser ? '账号信息已更新' : '新账号已创建', 'success');
      setShowFormModal(false);
      setEditingUser(null);
      fetchUsers(activeSearch, page, pageSize);
    } catch (err) {
      setFormError(err.message || '操作失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const openResetModal = (target) => {
    setResetTarget(target);
    setResetPasswords({ newPassword: '', confirmPassword: '' });
    setResetError('');
  };

  const closeResetModal = () => {
    if (resetSubmitting) return;
    setResetTarget(null);
    setResetError('');
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError('');

    if (!resetPasswords.newPassword || resetPasswords.newPassword.length < 6) {
      setResetError('新密码长度至少为 6 位');
      return;
    }
    if (resetPasswords.newPassword !== resetPasswords.confirmPassword) {
      setResetError('两次输入的密码不一致');
      return;
    }

    setResetSubmitting(true);
    try {
      const res = await fetchWithAuth(`/api/auth/users/${resetTarget.id}/password`, {
        method: 'PUT',
        body: JSON.stringify(resetPasswords)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || '重置密码失败');
      }
      showAppToast(data.message || '密码已重置', 'success');
      setResetTarget(null);
    } catch (err) {
      setResetError(err.message || '重置密码失败');
    } finally {
      setResetSubmitting(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetchWithAuth(`/api/auth/users/${deleteTarget.id}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || '删除失败');
      }
      showAppToast(`已删除账号「${deleteTarget.username}」`, 'success');
      setDeleteTarget(null);
      fetchUsers(activeSearch, page, pageSize);
    } catch (err) {
      showAppToast(`删除失败：${err.message}`, 'error');
      setDeleteTarget(null);
    }
  };

  const subtitleText = activeSearch && !loading
    ? `搜索 "${activeSearch}" · 共 ${pagination.total} 个账号`
    : loading
      ? '正在加载账号列表...'
      : `共 ${pagination.total} 个账号 · 管理角色权限、启停状态与密码重置`;

  return (
    <div>
      <PageToolbar
        title="账号与角色管理"
        subtitle={subtitleText}
        searchTerm={searchTerm}
        onSearchChange={(e) => setSearchTerm(e.target.value)}
        onClearSearch={clearSearch}
        searchPlaceholder="搜索用户名、邮箱或角色..."
        searching={searching}
        loading={loading}
        actionButton={
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            新增账号
          </button>
        }
      />

      {/* 角色权限说明条（数据来自数据库 dropdown_options） */}
      {roleOptions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {roleOptions.map((item) => {
            const meta = getRoleMeta(item.value, roleOptions);
            return (
              <div
                key={item.value}
                className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-start gap-3"
              >
                <Shield className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-md ${meta.className}`}>
                      {meta.label}
                    </span>
                    <span className="text-xs font-mono text-slate-400">{item.value}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 账号列表 */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 flex items-center justify-center gap-3 text-sm text-slate-500">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent" />
          正在加载账号数据...
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchUsers(activeSearch, page, pageSize)} />
      ) : users.length === 0 ? (
        <EmptyState
          title={activeSearch ? '未找到匹配账号' : '暂无账号数据'}
          description={activeSearch ? `没有匹配 "${activeSearch}" 的账号记录。` : '点击右上角“新增账号”创建新用户。'}
          actionLabel={activeSearch ? '清除搜索' : '新增账号'}
          onAction={activeSearch ? clearSearch : openCreateModal}
        />
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                      账号
                    </th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                      角色
                    </th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                      状态
                    </th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                      最近活动
                    </th>
                    <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-slate-500">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {users.map((item) => {
                  const roleMeta = getRoleMeta(item.role, roleOptions);
                  const isSelf = currentUser && Number(item.id) === Number(currentUser.id);
                  const isActive = item.isActive !== false;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                            {(item.username || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">
                                {item.username}
                              </span>
                              {isSelf && (
                                <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                  当前登录
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 truncate mt-0.5">
                              {item.email || '未设置邮箱'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium border rounded-md ${roleMeta.className}`}>
                          {roleMeta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs font-medium">
                        {isActive ? (
                          <span className="text-emerald-600">启用</span>
                        ) : (
                          <span className="text-rose-600">已禁用</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500 tabular-nums">
                        {formatDateTime(item.lastActivity || item.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-white border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors whitespace-nowrap"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => openResetModal(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            重置密码
                          </button>
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => setDeleteTarget(item)}
                            title={isSelf ? '不能删除当前登录账号' : '删除账号'}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-600 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            删除
                          </button>
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
            itemLabel="个账号"
          />
        </>
      )}

      {/* 新增 / 编辑账号弹窗 */}
      {showFormModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeFormModal();
          }}
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  {editingUser ? `编辑账号 — ${editingUser.username}` : '新增账号'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeFormModal}
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

              {!editingUser && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      用户名 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formState.username}
                      onChange={(e) => setFormState((prev) => ({ ...prev, username: e.target.value }))}
                      placeholder="3~50 个字符"
                      disabled={submitting}
                      className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      初始密码 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={formState.password}
                      onChange={(e) => setFormState((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="至少 6 位字符"
                      autoComplete="new-password"
                      disabled={submitting}
                      className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  角色权限 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formState.role}
                  onChange={(e) => setFormState((prev) => ({ ...prev, role: e.target.value }))}
                  disabled={submitting}
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                >
                  {roleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  邮箱（可选）
                </label>
                <input
                  type="email"
                  value={formState.email}
                  onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="name@example.com"
                  disabled={submitting}
                  className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex items-center justify-between py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <p className="text-xs font-medium text-slate-700">账号状态</p>
                  <p className="text-[11px] text-slate-400">禁用后该账号将无法登录或访问接口</p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.isActive}
                    onChange={(e) => setFormState((prev) => ({ ...prev, isActive: e.target.checked }))}
                    disabled={submitting}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {formState.isActive ? '启用' : '禁用'}
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeFormModal}
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
                  {submitting ? '保存中...' : editingUser ? '保存修改' : '创建账号'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 管理员重置密码弹窗 */}
      {resetTarget && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeResetModal();
          }}
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <KeyRound className="w-4 h-4 text-indigo-600 shrink-0" />
                <h2 className="text-base font-semibold text-slate-900 truncate">
                  重置密码 — {resetTarget.username}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeResetModal}
                aria-label="关闭"
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4">
              {resetError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg px-3 py-2">
                  {resetError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  新密码 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={resetPasswords.newPassword}
                  onChange={(e) =>
                    setResetPasswords((prev) => ({ ...prev, newPassword: e.target.value }))
                  }
                  placeholder="至少 6 位字符"
                  autoComplete="new-password"
                  disabled={resetSubmitting}
                  className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  确认新密码 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={resetPasswords.confirmPassword}
                  onChange={(e) =>
                    setResetPasswords((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  }
                  placeholder="请再次输入新密码"
                  autoComplete="new-password"
                  disabled={resetSubmitting}
                  className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeResetModal}
                  disabled={resetSubmitting}
                  className="h-9 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="h-9 px-4 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {resetSubmitting ? '重置中...' : '确认重置'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 删除账号确认框 */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="删除账号"
        message={deleteTarget ? `确定要删除账号「${deleteTarget.username}」吗？此操作不可恢复。` : ''}
        confirmText="确认删除"
        cancelText="取消"
        onConfirm={confirmDeleteUser}
        onCancel={() => setDeleteTarget(null)}
        isDanger={true}
      />
    </div>
  );
}
