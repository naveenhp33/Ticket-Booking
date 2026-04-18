import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ThumbsUp, 
  ThumbsDown, 
  Eye, 
  Calendar, 
  Edit3, 
  HelpCircle,
  Cpu,
  Users,
  Briefcase,
  Globe,
  Share2,
  Bookmark
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { knowledgeService } from '../services/ticketService';
import { formatDate } from '../utils/helpers';
import { Card, Button, Badge } from '../ui';
import { motion } from 'framer-motion';

const CATEGORY_MAP = {
  'IT': { icon: Cpu, color: '#4F46E5', bg: '#EEF2FF' },
  'HR': { icon: Users, color: '#10B981', bg: '#DCFCE7' },
  'Finance': { icon: Briefcase, color: '#F59E0B', bg: '#FEF3C7' },
  'Admin': { icon: Globe, color: '#EF4444', bg: '#FEE2E2' },
  'Other': { icon: HelpCircle, color: '#64748B', bg: '#F1F5F9' }
};

export default function KnowledgeArticlePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rated, setRated] = useState(false);
  
  const isAdminOrAgent = ['admin', 'support_agent'].includes(user?.role);

  useEffect(() => {
    knowledgeService.getOne(id)
      .then(res => setArticle(res.data.article))
      .catch(() => { toast.error('Article not found'); navigate('/knowledge'); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleRate = async (helpful) => {
    if (rated) return;
    try {
      await knowledgeService.rate(id, helpful);
      setRated(true);
      toast.success('Thank you for your feedback!');
    } catch { toast.error('Failed to submit rating'); }
  };

  if (loading) return <div className="flex-center" style={{ height: '80vh' }}><Badge variant="primary">Loading article...</Badge></div>;
  if (!article) return null;

  const catData = CATEGORY_MAP[article.category] || CATEGORY_MAP.Other;
  const CatIcon = catData.icon;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page-layout" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="flex-between mb-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/knowledge')} leftIcon={<ArrowLeft size={18} />}>Back to Hub</Button>
        <div className="flex-center gap-2">
           <Button variant="outline" size="sm" iconOnly><Share2 size={16} /></Button>
           <Button variant="outline" size="sm" iconOnly><Bookmark size={16} /></Button>
           {isAdminOrAgent && <Button variant="secondary" size="sm" leftIcon={<Edit3 size={16} />}>Edit Article</Button>}
        </div>
      </div>

      <header className="mb-10">
        <div className="flex-center mb-4" style={{ width: '48px', height: '48px', background: catData.bg, color: catData.color, borderRadius: 'var(--r-lg)' }}>
           <CatIcon size={24} />
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1.2, marginBottom: 'var(--s-4)' }}>{article.title}</h1>
        <div className="flex-center gap-6" style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>
           <span className="flex-center gap-1"><Calendar size={14} /> Last updated {formatDate(article.updatedAt || article.createdAt)}</span>
           <span className="flex-center gap-1"><Eye size={14} /> {article.viewCount || 0} relative views</span>
           <Badge variant="secondary">{article.category}</Badge>
        </div>
      </header>

      <Card style={{ padding: 'var(--s-8)', marginBottom: 'var(--s-10)' }}>
         <div style={{ fontSize: '1.1rem', lineHeight: 1.8, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
            {article.content}
         </div>
         
         {article.tags?.length > 0 && (
           <div className="flex gap-2 mt-8 flex-wrap">
              {article.tags.map(tag => (
                <span key={tag} style={{ padding: '4px 12px', background: 'var(--bg)', borderRadius: 'var(--r-full)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', border: '1px solid var(--border-light)' }}>
                   #{tag}
                </span>
              ))}
           </div>
         )}
      </Card>

      <section style={{ textAlign: 'center', padding: 'var(--s-12) 0', borderTop: '1px solid var(--border-light)' }}>
         <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--s-6)' }}>Was this article helpful?</h3>
         {rated ? (
           <div style={{ color: 'var(--success)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <ThumbsUp size={24} /> Thank you for your feedback!
           </div>
         ) : (
           <div className="flex-center gap-4">
              <Button variant="outline" onClick={() => handleRate(true)} leftIcon={<ThumbsUp size={18} />}>Yes, it was</Button>
              <Button variant="outline" onClick={() => handleRate(false)} leftIcon={<ThumbsDown size={18} />}>No, I need more help</Button>
           </div>
         )}
      </section>

      {user?.role !== 'admin' && (
        <Card style={{ background: 'var(--primary)', color: 'white', marginTop: 'var(--s-12)' }}>
           <div className="flex-between">
              <div style={{ textAlign: 'left' }}>
                 <h4 style={{ color: 'white', fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--s-1)' }}>Still have questions?</h4>
                 <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem' }}>Our support team is always here to help you out.</p>
              </div>
              <Button variant="secondary" onClick={() => navigate('/tickets/new')}>Raise a Ticket</Button>
           </div>
        </Card>
      )}
    </motion.div>
  );
}
