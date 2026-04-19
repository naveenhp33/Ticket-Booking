import { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Briefcase, 
  MapPin, 
  Bell, 
  Shield, 
  Key,
  Globe,
  Camera,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { userService } from '../services/ticketService';
import { getInitials, getAvatarColor } from '../utils/helpers';
import { Card, Button, Input, Badge } from '../ui';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  
  const [profile, setProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    designation: user?.designation || '',
    preferredContact: user?.preferredContact || 'email',
    location: {
      floor: user?.location?.floor || '',
      branch: user?.location?.branch || '',
      city: user?.location?.city || '',
    }
  });

  const [passwords, setPasswords] = useState({ 
    currentPassword: '', 
    newPassword: '', 
    confirmPassword: '' 
  });

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await userService.updateProfile(profile);
      updateUser(res.data.user);
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    setLoading(true);
    try {
      await userService.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      });
      toast.success('Password changed successfully');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password change failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page-layout">
      {/* Profile Header Card */}
      <Card style={{ marginBottom: 'var(--s-8)', background: 'linear-gradient(to right, #F8FAFC, #FFFFFF)' }}>
        <div className="flex-center gap-8" style={{ padding: 'var(--s-4)' }}>
           <div style={{ position: 'relative' }}>
              <div 
                className="flex-center" 
                style={{ 
                  width: '100px', height: '100px', background: getAvatarColor(user?.name), 
                  borderRadius: 'var(--r-2xl)', color: 'white', fontSize: '2.5rem', fontWeight: 800 
                }}
              >
                {getInitials(user?.name)}
              </div>
              <button className="flex-center" style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '32px', height: '32px', background: 'white', borderRadius: '50%', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <Camera size={16} />
              </button>
           </div>
           <div className="flex-1">
              <div className="flex-center gap-3 mb-1">
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{user?.name}</h1>
                <Badge variant="primary">{user?.role?.replace('_', ' ')}</Badge>
              </div>
              <p style={{ color: 'var(--text-dim)', marginBottom: 'var(--s-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={16} /> {user?.email}
              </p>
              <div className="flex-center gap-6">
                 <div className="flex-center gap-2">
                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{user?.stats?.totalRaised || 0}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Tickets Raised</span>
                 </div>
                 <div className="flex-center gap-2">
                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{user?.stats?.totalResolved || 0}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Resolved</span>
                 </div>
              </div>
           </div>
           <Button variant="outline">View Public Profile</Button>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 'var(--s-8)' }}>
        {/* Nav Sidebar */}
        <div className="flex-col gap-2">
           {[
             { id: 'profile', label: 'General info', icon: User },
             { id: 'security', label: 'Security & Auth', icon: Shield },
             { id: 'notifications', label: 'Notifications', icon: Bell },
           ].map(tab => (
             <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`premium-nav-item ${activeTab === tab.id ? 'active' : ''}`}
             >
               <tab.icon size={18} />
               <span>{tab.label}</span>
             </button>
           ))}
        </div>

        {/* Content Area */}
        <div className="flex-col gap-8">
           <AnimatePresence mode="wait">
             {activeTab === 'profile' && (
               <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                 <Card title="Personal Information" subtitle="Update your basic profile details here.">
                    <form onSubmit={handleUpdateProfile} className="flex-col gap-6">
                       <div className="form-grid-2">
                          <Input label="Full Name" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} />
                          <Input label="Designation" value={profile.designation} onChange={e => setProfile({...profile, designation: e.target.value})} />
                          <Input label="Phone Number" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} />
                          <div className="input-group">
                            <label className="input-label">Preferred Contact</label>
                            <select className="input" value={profile.preferredContact} onChange={e => setProfile({...profile, preferredContact: e.target.value})}>
                               <option value="email">Email Address</option>
                               <option value="phone">Phone Call</option>
                               <option value="slack">Slack Message</option>
                            </select>
                          </div>
                       </div>
                       
                       <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 'var(--s-6)' }}>
                          <h4 style={{ marginBottom: 'var(--s-4)', fontSize: '0.9rem' }}>Work Location</h4>
                          <div className="form-grid-3">
                             <Input label="Floor" value={profile.location.floor} onChange={e => setProfile({...profile, location: {...profile.location, floor: e.target.value}})} />
                             <Input label="Branch" value={profile.location.branch} onChange={e => setProfile({...profile, location: {...profile.location, branch: e.target.value}})} />
                             <Input label="City" value={profile.location.city} onChange={e => setProfile({...profile, location: {...profile.location, city: e.target.value}})} />
                          </div>
                       </div>

                       <div className="flex-center" style={{ justifyContent: 'flex-end', marginTop: 'var(--s-4)' }}>
                          <Button type="submit" isLoading={loading}>Save Updates</Button>
                       </div>
                    </form>
                 </Card>
               </motion.div>
             )}

             {activeTab === 'security' && (
               <motion.div key="security" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                 <Card title="Security Settings" subtitle="Keep your account secure with a strong password.">
                    <form onSubmit={handleChangePassword} className="flex-col gap-6">
                       <Input type="password" label="Current Password" placeholder="••••••••" value={passwords.currentPassword} onChange={e => setPasswords({...passwords, currentPassword: e.target.value})} />
                       <div className="form-grid-2">
                          <Input type="password" label="New Password" placeholder="••••••••" value={passwords.newPassword} onChange={e => setPasswords({...passwords, newPassword: e.target.value})} />
                          <Input type="password" label="Confirm Password" placeholder="••••••••" value={passwords.confirmPassword} onChange={e => setPasswords({...passwords, confirmPassword: e.target.value})} />
                       </div>
                       <div className="flex-center" style={{ justifyContent: 'flex-end' }}>
                          <Button type="submit" isLoading={loading} leftIcon={<Key size={18} />}>Update Password</Button>
                       </div>
                    </form>
                 </Card>
                 
                 <Card style={{ marginTop: 'var(--s-6)', border: '1px solid #FFE4E6', background: '#FFF1F2' }}>
                    <div className="flex-between">
                       <div>
                         <h4 style={{ color: 'var(--danger)', fontWeight: 700 }}>Deactivate Account</h4>
                         <p style={{ fontSize: '0.8rem', color: '#991B1B' }}>Permanently remove your access to the portal.</p>
                       </div>
                       <Button variant="danger" size="sm" onClick={() => {
                          if (window.confirm('Are you sure you want to deactivate your account? You will lose access to the portal.')) {
                            toast.warning('Account deactivation must be approved by an administrator.');
                          }
                        }}>Deactivate</Button>
                    </div>
                 </Card>
               </motion.div>
             )}
           </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
