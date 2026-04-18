import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowLeft, Construction } from 'lucide-react';
import { Button } from '../ui';
import { motion } from 'framer-motion';

const PlaceholderPage = ({ title }) => {
  const navigate = useNavigate();

  return (
    <div style={{ 
      padding: '40px', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '70vh' 
    }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ 
          maxWidth: '560px', 
          width: '100%',
          textAlign: 'center',
          padding: '60px var(--s-8)', 
          background: 'white', 
          borderRadius: '24px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.08)',
          border: '1px solid var(--border-light)'
        }}
      >
        <div style={{ 
            width: '80px', 
            height: '80px', 
            background: 'var(--primary-light)', 
            color: 'var(--primary)', 
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 32px'
        }}>
          <Sparkles size={40} />
        </div>

        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: '800', 
          color: 'var(--text-dark)',
          marginBottom: '16px',
          letterSpacing: '-0.02em'
        }}>
          {title || 'Under Construction'}
        </h1>
        
        <p style={{ 
          fontSize: '1.1rem', 
          color: 'var(--text-dim)',
          lineHeight: '1.6',
          marginBottom: '40px'
        }}>
           The <b>{title}</b> experience is currently being optimized for peak performance. <br/>
           We are preparing something special for the next update.
        </p>

        <div className="flex-center gap-4" style={{ justifyContent: 'center' }}>
            <Button 
                variant="ghost" 
                leftIcon={<ArrowLeft size={18} />}
                onClick={() => navigate(-1)}
            >
                Go Back
            </Button>
            <Button 
                onClick={() => navigate('/dashboard')}
                leftIcon={<Construction size={18} />}
            >
                To Dashboard
            </Button>
        </div>

        <div style={{ marginTop: '48px', paddingTop: '32px', borderTop: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Release Candidate v1.4.0
            </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PlaceholderPage;
