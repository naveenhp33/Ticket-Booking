import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Search, 
  Plus, 
  ChevronRight, 
  Eye, 
  ThumbsUp,
  Cpu,
  Users,
  Briefcase,
  Globe,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { knowledgeService } from '../services/ticketService';
import { timeAgo } from '../utils/helpers';
import { Card, Button, Input, Badge } from '../ui';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORY_MAP = {
  'IT': { icon: Cpu, color: '#4F46E5', bg: '#EEF2FF' },
  'HR': { icon: Users, color: '#10B981', bg: '#DCFCE7' },
  'Finance': { icon: Briefcase, color: '#F59E0B', bg: '#FEF3C7' },
  'Admin': { icon: Globe, color: '#EF4444', bg: '#FEE2E2' },
  'Other': { icon: HelpCircle, color: '#64748B', bg: '#F1F5F9' }
};

export default function KnowledgePage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  
  const isAdminOrAgent = ['admin', 'support_agent'].includes(user?.role);

  useEffect(() => {
    fetchArticles();
  }, [category]);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const res = await knowledgeService.getAll({ category });
      setArticles(res.data.articles || []);
      setLoading(false);
    } catch {
      toast.error('Failed to load articles');
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearch(q);
    if (!q.trim()) { fetchArticles(); return; }
    try {
      const res = await knowledgeService.search({ q, category });
      setArticles(res.data.articles || []);
    } catch {}
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="page-layout">
      {/* Search Hero */}
      <div 
        style={{ 
          background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)', 
          borderRadius: 'var(--r-xl)', 
          padding: 'var(--s-12) var(--s-8)', 
          textAlign: 'center',
          color: 'white',
          marginBottom: 'var(--s-10)'
        }}
      >
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: 'var(--s-2)', color: 'white' }}>Knowledge Base</h1>
        <p style={{ opacity: 0.9, fontSize: '1.1rem', marginBottom: 'var(--s-8)' }}>Search our resources or browse by category to find instant answers.</p>
        
        <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative' }}>
          <Search size={22} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-dim)' }} />
          <input 
            className="input" 
            style={{ 
              height: '56px', paddingLeft: '56px', border: 'none', 
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '1rem',
              borderRadius: 'var(--r-lg)'
            }}
            placeholder="Search for articles, how-tos, FAQs..."
            value={search}
            onChange={handleSearch}
          />
        </div>
      </div>

      <div className="flex-between mb-8" style={{ marginBottom: 'var(--s-8)' }}>
        <div className="flex-center gap-2" style={{ flexWrap: 'wrap' }}>
          <Button 
            variant={!category ? 'primary' : 'outline'} 
            size="sm" 
            onClick={() => setCategory('')}
          >
            All Resources
          </Button>
          {Object.entries(CATEGORY_MAP).map(([name, data]) => {
            const Icon = data.icon;
            return (
              <Button 
                key={name}
                variant={category === name ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setCategory(name)}
                leftIcon={<Icon size={14} />}
              >
                {name}
              </Button>
            );
          })}
        </div>
        {isAdminOrAgent && <Button variant="secondary" leftIcon={<Plus size={18} />}>Create Article</Button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--s-6)' }}>
        <AnimatePresence mode="popLayout">
          {loading ? (
             Array.from({ length: 6 }).map((_, i) => (
               <Card key={i} style={{ height: '180px', animation: 'pulse 1.5s infinite' }} />
             ))
          ) : articles.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--s-12)' }}>
               <Badge variant="warning">No articles found</Badge>
            </div>
          ) : (
            articles.map((article, idx) => {
              const catData = CATEGORY_MAP[article.category] || CATEGORY_MAP.Other;
              const CatIcon = catData.icon;
              return (
                <motion.div
                   key={article._id}
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   transition={{ delay: idx * 0.05 }}
                   onClick={() => navigate(`/knowledge/${article._id}`)}
                >
                  <Card 
                    className="kb-card" 
                    style={{ 
                      cursor: 'pointer', transition: 'var(--t-fast)', border: '1px solid var(--border-light)' 
                    }}
                  >
                    <div 
                      className="flex-center" 
                      style={{ 
                        width: '40px', height: '40px', background: catData.bg, 
                        color: catData.color, borderRadius: 'var(--r-md)', marginBottom: 'var(--s-4)' 
                      }}
                    >
                      <CatIcon size={20} />
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--s-2)' }}>{article.title}</h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)', marginBottom: 'var(--s-6)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {article.content.substring(0, 100)}...
                    </p>
                    <div className="flex-between" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 'var(--s-4)' }}>
                      <div className="flex-center gap-3" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        <span className="flex-center gap-1"><Eye size={12} /> {article.viewCount || 0}</span>
                        <span className="flex-center gap-1"><ThumbsUp size={12} /> {article.helpfulCount || 0}</span>
                      </div>
                      <ChevronRight size={16} color="var(--text-dim)" />
                    </div>
                  </Card>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .kb-card:hover { transform: translateY(-4px); border-color: var(--primary) !important; box-shadow: var(--shadow-lg); }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
      `}</style>
    </motion.div>
  );
}
