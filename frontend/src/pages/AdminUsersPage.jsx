import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Shield, 
  Mail, 
  Building2, 
  Activity,
  UserCheck,
  UserMinus,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { userService } from '../services/ticketService';
import { getInitials, getAvatarColor, timeAgo } from '../utils/helpers';
import { Card, Button, Input, Badge } from '../ui';
import { motion, AnimatePresence } from 'framer-motion';

const ROLES = ['employee', 'support_agent', 'admin'];
const DEPARTMENTS = ['IT', 'HR', 'Finance', 'Admin', 'Operations', 'Marketing', 'Sales', 'Legal'];

export default function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await userService.getAll({ search, role: roleFilter });
      setUsers(res.data.users);
      setLoading(false);
    } catch {
      toast.error('Failed to load users');
      setLoading(false);
    }
  };

  const openEdit = (user) => {
    setSelectedUser(user);
    setEditForm({
      role: user.role,
      department: user.department,
      designation: user.designation || '',
      isActive: user.isActive
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
      await userService.update(selectedUser._id, editForm);
      toast.success('User updated successfully');
      setIsEditModalOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error('Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="page-layout">
      {/* Page Header */}
      <div className="flex-between mb-8" style={{ marginBottom: 'var(--s-8)' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem' }}>Team Management</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage your organization's users, roles, and permissions.</p>
        </div>
        <div className="flex-center gap-3">
          <Badge variant="primary" className="p-2 px-4">{users.length} Total Users</Badge>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="mb-6" style={{ padding: 'var(--s-4)', marginBottom: 'var(--s-6)' }}>
        <div className="flex-between gap-4">
          <div className="flex-1 flex-center gap-4">
            <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-dim)' }} />
              <input 
                placeholder="Search by name, email or employee ID..." 
                className="input" 
                style={{ paddingLeft: '40px' }}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            
            <select 
              className="input" 
              style={{ width: '180px' }}
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>

          <Button variant="outline" leftIcon={<Filter size={16} />}>Advanced Filters</Button>
        </div>
      </Card>

      {/* Users Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '300px' }}>User Details</th>
              <th>Role</th>
              <th>Department</th>
              <th>Workload</th>
              <th>Last Activity</th>
              <th>Status</th>
              <th style={{ width: '40px' }}></th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan="7"><div style={{ height: '48px', background: 'var(--surface-alt)', width: '100%', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} /></td></tr>
                ))
              ) : (
                users.map((user, idx) => (
                  <motion.tr 
                    key={user._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => openEdit(user)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div className="flex-center gap-3">
                        <div 
                          className="flex-center" 
                          style={{ 
                            width: '40px', height: '40px', 
                            background: getAvatarColor(user.name), 
                            borderRadius: 'var(--r-md)', color: 'white', fontWeight: 700 
                          }}
                        >
                          {getInitials(user.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700 }}>{user.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Mail size={12} /> {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge variant={user.role === 'admin' ? 'danger' : user.role === 'support_agent' ? 'primary' : 'secondary'}>
                        {user.role.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex-center gap-2" style={{ fontSize: '0.875rem' }}>
                        <Building2 size={14} color="var(--text-dim)" /> {user.department}
                      </div>
                    </td>
                    <td>
                      {user.role === 'support_agent' ? (
                        <div style={{ fontWeight: 600 }}>{user.currentWorkload || 0} Tickets</div>
                      ) : '—'}
                    </td>
                    <td style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>
                       {user.lastLogin ? timeAgo(user.lastLogin) : 'Never'}
                    </td>
                    <td>
                      <div className="flex-center gap-2">
                        {user.isActive ? (
                          <><CheckCircle2 size={14} color="var(--success)" /> <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--success)' }}>Active</span></>
                        ) : (
                          <><XCircle size={14} color="var(--danger)" /> <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--danger)' }}>Inactive</span></>
                        )}
                      </div>
                    </td>
                    <td><button className="p-2 hover-surface rounded-md"><MoreHorizontal size={18} color="var(--text-dim)" /></button></td>
                  </motion.tr>
                ))
              )}
            </AnimatePresence>
          </tbody>
        </table>
        
        {/* Pagination Footer */}
        <div className="flex-between" style={{ padding: 'var(--s-4)', background: 'var(--surface-alt)' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Showing users 1-10 of {users.length}</div>
          <div className="flex-center gap-2">
             <Button variant="outline" size="sm"><ChevronLeft size={16} /></Button>
             <Button variant="outline" size="sm"><ChevronRight size={16} /></Button>
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {isEditModalOpen && (
        <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="modal" 
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header flex-between">
              <div>
                <h3 className="card-title" style={{ marginBottom: 0 }}>Update Permissions</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Changing rights for {selectedUser.name}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsEditModalOpen(false)}>✕</Button>
            </div>
            <div className="modal-body">
              <div className="flex-col gap-6">
                 <div className="input-group">
                   <label className="input-label">Workspace Role</label>
                   <select 
                    className="input"
                    value={editForm.role}
                    onChange={e => setEditForm({...editForm, role: e.target.value})}
                   >
                     {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                   </select>
                   <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>Administrative roles can manage all department settings.</p>
                 </div>

                 <div className="input-group">
                   <label className="input-label">Department</label>
                   <select 
                    className="input"
                    value={editForm.department}
                    onChange={e => setEditForm({...editForm, department: e.target.value})}
                   >
                     {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                   </select>
                 </div>

                 <div className="flex-between p-4" style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Active Account</div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Allow user to sign in to the portal.</p>
                    </div>
                    <button 
                      onClick={() => setEditForm({...editForm, isActive: !editForm.isActive})}
                      style={{ 
                        width: '44px', height: '22px', background: editForm.isActive ? 'var(--success)' : 'var(--text-dim)', 
                        borderRadius: 'var(--r-full)', position: 'relative', transition: 'var(--t-fast)' 
                      }}
                    >
                      <div style={{ position: 'absolute', top: '2px', left: editForm.isActive ? '24px' : '2px', width: '18px', height: '18px', background: 'white', borderRadius: '50%', transition: 'var(--t-fast)' }} />
                    </button>
                 </div>
              </div>
            </div>
            <div className="modal-footer">
               <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>Discard</Button>
               <Button isLoading={saving} onClick={handleUpdate}>Save Changes</Button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
