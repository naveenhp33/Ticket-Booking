import React from 'react';

export const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  isLoading = false,
  leftIcon,
  rightIcon,
  ...props 
}) => {
  const variants = {
    primary: 'button-primary',
    secondary: 'button-secondary',
    ghost: 'button-ghost',
    danger: 'button-danger',
    outline: 'button-outline'
  };

  const sizes = {
    sm: 'button-sm',
    md: 'button-md',
    lg: 'button-lg'
  };

  return (
    <button 
      className={`btn ${variants[variant]} ${sizes[size]} ${className} ${isLoading ? 'loading' : ''}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <span className="button-spinner"></span>
      ) : (
        <>
          {leftIcon && <span className="btn-icon-left">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="btn-icon-right">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};

export const Card = ({ children, title, subtitle, className = '', footer, ...props }) => (
  <div className={`card ${className}`} {...props}>
    {title && (
      <div className="card-header">
        <div>
          <h3 className="card-title">{title}</h3>
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
      </div>
    )}
    <div className="card-body">
      {children}
    </div>
    {footer && <div className="card-footer">{footer}</div>}
  </div>
);

export const Badge = ({ children, variant = 'primary', className = '' }) => (
  <span className={`badge badge-${variant} ${className}`}>
    {children}
  </span>
);

export const Input = React.forwardRef(({ label, error, className = '', ...props }, ref) => (
  <div className="input-group">
    {label && <label className="input-label">{label}</label>}
    <input 
      ref={ref}
      className={`input ${error ? 'input-error' : ''} ${className}`}
      {...props}
    />
    {error && <span className="input-error-msg">{error}</span>}
  </div>
));
