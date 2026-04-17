import { motion } from 'framer-motion';
import { Construction } from 'lucide-react';
import { Button } from '../ui';
import { useNavigate } from 'react-router-dom';

export default function PlaceholderPage({ title }) {
  const navigate = useNavigate();
  return (
    <div className="flex-center flex-col" style={{ height: '80vh', textAlign: 'center' }}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Construction size={100} color="var(--primary)" style={{ marginBottom: '24px', opacity: 0.5 }} />
        <h1 style={{ fontSize: '2.5rem', marginBottom: '16px' }}>{title}</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '1.1rem', maxWidth: '500px', marginBottom: '32px' }}>
          This page is under construction and will be available in the next release.
        </p>
        <Button size="lg" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
      </motion.div>
    </div>
  );
}
