import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ className = '', message = 'Loading' }) => (
  <div className={`loading ${className}`} role="status">
    <div aria-hidden="true" className="spinner" />
    {message && <span>{message}</span>}
  </div>
);

export default LoadingSpinner;
