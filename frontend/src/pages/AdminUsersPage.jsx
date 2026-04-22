import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import {
  Users, Search, Filter, MoreHorizontal,
  Mail, Building2, UserCheck,
  ChevronLeft, ChevronRight,
  KeyRound, UserPlus, Upload, Download
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { userService } from '../services/ticketService';
import { getInitials, getAvatarColor, timeAgo } from '../utils/helpers';
import { Card, Button, Input, Badge } from '../ui';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const ROLES = ['employee', 'support_agent', 'admin'];
const DEPARTMENTS = ['IT', 'HR', 'Finance', 'Admin', 'Operations', 'Marketing', 'Sales', 'Legal'];
const PAGE_LIMIT = 20;

export default function AdminUsersPage() {
  const toast = useToast();
  const { on } = useSocket();
  const fileInputRef = useRef(null);

  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', name: '', role: 'employee', department: 'IT', designation: '', password: '' });
  const [createdPassword, setCreatedPassword] = useState(null); // shown once after creation
  const [creating, setCreating]     = useState(false);

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetPassword, setResetPassword]       = useState('');
  const [resetting, setResetting]               = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm]               = useState({});
  const [saving, setSaving]                   = useState(false);

  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds]         = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting]               = useState(false);

  const allSelected = users.length > 0 && users.every(u => selectedIds.includes(u._id));
  const toggleAll   = () => setSelectedIds(allSelected ? [] : users.map(u => u._id));
  const toggleOne   = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, roleFilter]);
  useEffect(() => { fetchUsers(); }, [search, roleFilter, page]);

  useEffect(() => {
    if (!on) return;
    const off = on('user_updated', (data) => {
      setUsers(prev => prev.map(u => u._id === data.user._id ? data.user : u));
    });
    return () => off && off();
  }, [on]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users', { params: { search, role: roleFilter, page, limit: PAGE_LIMIT, isActive: undefined } });
      setUsers(res.data.users);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
    return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const handleCreate = async () => {
    if (!createForm.email || !createForm.name)
      return toast.error('Email and name are required');
    const password = createForm.password || generatePassword();
    setCreating(true);
    try {
      await api.post('/auth/admin/create-user', { ...createForm, password });
      setCreatedPassword(password);
      setCreateForm({ email: '', name: '', role: 'employee', department: 'IT', designation: '', password: '' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPassword || resetPassword.length < 8)
      return toast.error('Password must be at least 8 characters');
    setResetting(true);
    try {
      await api.put('/auth/admin/reset-password', { userId: selectedUser._id, newPassword: resetPassword });
      toast.success('Password updated. Share with employee manually if needed.');
      setIsResetModalOpen(false);
      setResetPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  const openEdit = (user) => {
    setSelectedUser(user);
    setEditForm({ role: user.role, department: user.department, designation: user.designation || '', isActive: user.isActive });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
      await userService.update(selectedUser._id, editForm);
      toast.success('User updated successfully');
      setIsEditModalOpen(false);
      fetchUsers();
    } catch {
      toast.error('Update failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Bulk Import ──────────────────────────────────────────────
  const downloadTemplate = () => {
    const rows = [
      'name,email,role,id,department,team,shift,designation,experience',
      'John Doe,john.doe@vdartinc.com,employee,EMP001,IT,Dev Team A,morning,Software Engineer,2 years',
      'Jane Smith,jane.smith@vdartinc.com,support_agent,EMP002,HR,HR Wing,afternoon,HR Specialist,4 years',
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows);
    a.download = 'import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleBulkImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/users/bulk-import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`✅ ${res.data.imported} imported, ${res.data.updated} updated, ${res.data.skipped} skipped`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    try {
      const res = await api.delete('/users/bulk-delete', { data: { userIds: selectedIds } });
      toast.success(`🗑️ ${res.data.deleted} user${res.data.deleted !== 1 ? 's' : ''} deleted`);
      setSelectedIds([]);
      setShowDeleteConfirm(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const start = (page - 1) * PAGE_LIMIT + 1;
  const end   = Math.min(page * PAGE_LIMIT, total);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="page-layout">

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div style={{
          position: 'sticky', top: '16px', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#1F4E79', color: 'white',
          padding: '12px 20px', borderRadius: '12px',
          marginBottom: '16px', boxShadow: '0 4px 16px rgba(31,78,121,0.35)'
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
            {selectedIds.length} User{selectedIds.length !== 1 ? 's' : ''} Selected
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setSelectedIds([])}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
            >
              Clear
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{ background: '#d32f2f', border: 'none', color: 'white', padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
            >
              🗑 Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex-between mb-8">
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 800 }}>Team Management</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage your organisation's users, roles, and permissions.</p>
        </div>
        <div className="flex-center gap-3">
          {/* Bulk Import */}
          <Button variant="outline" size="sm" leftIcon={<Download size={15} />} onClick={downloadTemplate}>
            CSV Template
          </Button>
          <Button
            variant="outline" size="sm"
            leftIcon={<Upload size={15} />}
            isLoading={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            Import CSV
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleBulkImport} />
          <Button onClick={() => setIsCreateModalOpen(true)} leftIcon={<UserPlus size={16} />}>Add User</Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex-between gap-4 mb-8" style={{ background: 'white', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="flex-center gap-4 flex-1">
          <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              placeholder="Search by name or email..."
              className="input"
              style={{ paddingLeft: '36px', background: 'var(--bg)', border: '1px solid transparent', height: '36px', fontSize: '0.85rem' }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex-center gap-2">
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Role</span>
            <select
              className="input"
              style={{ width: '150px', height: '32px', fontSize: '0.8rem', background: 'var(--bg)', border: '1px solid transparent' }}
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{total} total users</span>
      </div>

      {/* Table */}
      <div className="ent-table-wrap">
        <table className="ent-table">
          <thead>
            <tr>
              <th className="col-check">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  style={{ display: 'block', margin: '0 auto', width: '16px', height: '16px', accentColor: '#fff', cursor: 'pointer' }}
                />
              </th>
              <th style={{ width: '260px' }}>User</th>
              <th className="col-center" style={{ width: '110px' }}>Role</th>
              <th style={{ width: '120px' }}>Department</th>
              <th className="col-center" style={{ width: '100px' }}>Workload</th>
              <th style={{ width: '110px' }}>Last Login</th>
              <th className="col-center" style={{ width: '140px' }}>Status</th>
              <th className="col-right" style={{ width: '60px' }}></th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}><td colSpan="8"><div style={{ height: '44px', background: 'var(--surface-alt)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} /></td></tr>
                  ))
                : users.map((u, idx) => (
                    <motion.tr
                      key={u._id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      onClick={() => openEdit(u)}
                      style={{ cursor: 'pointer', background: selectedIds.includes(u._id) ? '#EFF6FF' : undefined }}
                    >
                      <td className="col-check" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(u._id)}
                          onChange={() => toggleOne(u._id)}
                        />
                      </td>
                      <td style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div className="flex-center" style={{ width: '36px', height: '36px', background: getAvatarColor(u.name), borderRadius: '8px', color: 'white', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                            {getInitials(u.name)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || '—'}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="col-center"><Badge variant={u.role === 'admin' ? 'danger' : u.role === 'support_agent' ? 'primary' : 'secondary'}>{u.role.replace('_', ' ')}</Badge></td>
                      <td>{u.department}</td>
                      <td className="col-center">
                        {u.role === 'support_agent'
                          ? <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{u.currentWorkload || 0} open</span>
                          : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                      </td>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{u.lastLogin ? timeAgo(u.lastLogin) : 'Never'}</td>
                      <td className="col-center">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flexWrap: 'wrap' }}>
                          {u.isVerified ? <Badge variant="success">Verified</Badge> : <Badge variant="warning">Pending</Badge>}
                          {u.isActive  ? <Badge variant="primary">Active</Badge>   : <Badge variant="secondary">Inactive</Badge>}
                        </div>
                      </td>
                      <td className="col-right">
                        <button className="row-action-btn" style={{ marginLeft: 'auto' }} onClick={e => { e.stopPropagation(); openEdit(u); }}><MoreHorizontal size={18} /></button>
                      </td>
                    </motion.tr>
                  ))
              }
            </AnimatePresence>
          </tbody>
        </table>

        {/* Pagination Footer */}
        <div className="ent-table-footer">
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {total > 0 ? `Showing ${start}–${end} of ${total} users` : 'No users found'}
          </div>
          <div className="flex-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}><ChevronLeft size={16} /></Button>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, padding: '0 8px' }}>{page} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}><ChevronRight size={16} /></Button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && selectedUser && (
        <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header flex-between">
              <div>
                <h3 className="card-title" style={{ marginBottom: 0 }}>Update Permissions</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Editing {selectedUser.name}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsEditModalOpen(false)}>✕</Button>
            </div>
            <div className="modal-body">
              <div className="flex-col gap-6">
                <div className="input-group">
                  <label className="input-label">Role</label>
                  <select className="input" value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})}>
                    {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Department</label>
                  <select className="input" value={editForm.department} onChange={e => setEditForm({...editForm, department: e.target.value})}>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="flex-between p-4" style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Active Account</div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Allow user to sign in.</p>
                  </div>
                  <button
                    onClick={() => setEditForm({...editForm, isActive: !editForm.isActive})}
                    style={{ width: '44px', height: '22px', background: editForm.isActive ? 'var(--success)' : 'var(--text-dim)', borderRadius: 'var(--r-full)', position: 'relative', transition: 'var(--t-fast)', border: 'none', cursor: 'pointer' }}
                  >
                    <div style={{ position: 'absolute', top: '2px', left: editForm.isActive ? '24px' : '2px', width: '18px', height: '18px', background: 'white', borderRadius: '50%', transition: 'var(--t-fast)' }} />
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>Discard</Button>
              <Button variant="outline" leftIcon={<KeyRound size={16} />} onClick={() => { setIsEditModalOpen(false); setIsResetModalOpen(true); }}>Reset Password</Button>
              <Button isLoading={saving} onClick={handleUpdate}>Save Changes</Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetModalOpen && selectedUser && (
        <div className="modal-overlay" onClick={() => setIsResetModalOpen(false)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 className="card-title">Reset Password</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>New password for {selectedUser.name} will be emailed to them.</p>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">New Password</label>
                <input className="input" type="password" placeholder="Min 8 characters" value={resetPassword} onChange={e => setResetPassword(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="ghost" onClick={() => setIsResetModalOpen(false)}>Cancel</Button>
              <Button isLoading={resetting} onClick={handleResetPassword}>Reset & Send Email</Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => { setIsCreateModalOpen(false); setCreatedPassword(null); }}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="card-title">Add New User</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Credentials are stored securely. Share manually via ticket if needed.</p>
            </div>

            {createdPassword ? (
              /* ── Password Reveal Panel (shown once after creation) ── */
              <div className="modal-body">
                <div style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '10px', padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#166534', marginBottom: '8px' }}>✅ User Created Successfully</div>
                  <p style={{ fontSize: '0.82rem', color: '#166534', marginBottom: '16px' }}>Store this password securely. It will not be shown again.</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'white', border: '1.5px solid #1F4E79', borderRadius: '8px', padding: '10px 14px' }}>
                    <code style={{ flex: 1, fontSize: '1.1rem', fontWeight: 800, letterSpacing: '3px', color: '#1F4E79' }}>{createdPassword}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(createdPassword); toast.success('Password copied!'); }}
                      style={{ background: '#1F4E79', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Create Form ── */
              <div className="modal-body flex-col gap-4">
                <div className="form-grid-2">
                  <div className="input-group">
                    <label className="input-label">Work Email *</label>
                    <input className="input" placeholder="name@vdartinc.com" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Full Name *</label>
                    <input className="input" placeholder="Full name" value={createForm.name} onChange={e => setCreateForm({...createForm, name: e.target.value})} />
                  </div>
                </div>
                <div className="form-grid-2">
                  <div className="input-group">
                    <label className="input-label">Role</label>
                    <select className="input" value={createForm.role} onChange={e => setCreateForm({...createForm, role: e.target.value})}>
                      {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Department</label>
                    <select className="input" value={createForm.department} onChange={e => setCreateForm({...createForm, department: e.target.value})}>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-grid-2">
                  <div className="input-group">
                    <label className="input-label">Designation</label>
                    <input className="input" placeholder="e.g. Developer" value={createForm.designation} onChange={e => setCreateForm({...createForm, designation: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Password <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(leave blank to auto-generate)</span></label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input className="input" type="text" placeholder="Auto-generated if empty" value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})} style={{ flex: 1 }} />
                      <button type="button" onClick={() => setCreateForm({...createForm, password: generatePassword()})} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0 12px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--primary)' }}>Generate</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="modal-footer">
              <Button variant="ghost" onClick={() => { setIsCreateModalOpen(false); setCreatedPassword(null); }}>Close</Button>
              {!createdPassword && <Button isLoading={creating} onClick={handleCreate}>Create User</Button>}
            </div>
          </motion.div>
        </div>
      )}

      {/* Bulk Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="modal" onClick={e => e.stopPropagation()}
            style={{ maxWidth: '440px' }}
          >
            <div className="modal-header">
              <h3 className="card-title" style={{ color: '#d32f2f' }}>🗑️ Delete Users</h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-main)' }}>
                Are you sure you want to permanently delete{' '}
                <strong style={{ color: '#d32f2f' }}>{selectedIds.length} user{selectedIds.length !== 1 ? 's' : ''}</strong>?<br />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>This action cannot be undone.</span>
              </p>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{ background: 'none', border: '1px solid var(--border)', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                style={{ background: '#d32f2f', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, opacity: deleting ? 0.7 : 1 }}
              >
                {deleting ? 'Deleting...' : `Delete ${selectedIds.length} User${selectedIds.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
