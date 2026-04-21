import React from 'react';
import { motion } from 'framer-motion';

export const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  isLoading, 
  fullWidth,
  leftIcon, 
  rightIcon, 
  className = '', 
  ...props 
}) => {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    outline: 'btn-outline',
    ghost: 'btn-ghost',
    danger: 'btn-danger'
  };

  const sizes = {
    sm: 'btn-sm',
    md: 'btn-md',
    lg: 'btn-lg'
  };

  return (
    <button 
      className={`btn ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className} ${isLoading ? 'btn-loading' : ''}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && <span className="spinner" style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />}
      {!isLoading && leftIcon && <span className="btn-icon-left">{leftIcon}</span>}
      <span className="btn-text">{children}</span>
      {!isLoading && rightIcon && <span className="btn-icon-right">{rightIcon}</span>}
    </button>
  );
};

export const Card = ({ title, subtitle, children, className = '', footer, ...props }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={`card ${className}`} 
    {...props}
  >
    {(title || subtitle) && (
      <div className="card-header">
        {title && <h3 className="card-title">{title}</h3>}
        {subtitle && <p className="card-subtitle">{subtitle}</p>}
      </div>
    )}
    <div className="card-body">
      {children}
    </div>
    {footer && <div className="card-footer">{footer}</div>}
  </motion.div>
);

export const Badge = ({ children, variant = 'primary', className = '' }) => {
  const variants = {
    primary: 'badge-primary',
    secondary: 'badge-secondary',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info'
  };
  return (
    <span className={`badge ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

export const Input = ({ label, error, leftIcon, className = '', ...props }) => (
  <div className={`input-group ${className}`}>
    {label && <label className="input-label">{label}</label>}
    <div style={{ position: 'relative' }}>
      {leftIcon && (
        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', display: 'flex' }}>
          {leftIcon}
        </span>
      )}
      <input 
        className={`input ${error ? 'input-error' : ''}`} 
        style={leftIcon ? { paddingLeft: '40px' } : {}}
        {...props} 
      />
    </div>
    {error && <span className="input-error-text">{error}</span>}
  </div>
);
