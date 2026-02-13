
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "px-6 py-2.5 rounded-xl font-bold transition-all duration-500 flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.96] active:duration-100 ease-[cubic-bezier(0.16,1,0.3,1)]";
  
  const variants = {
    primary: "bg-white text-black hover:bg-[#ececec] hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.2)] hover:-translate-y-0.5",
    secondary: "bg-transparent text-zinc-400 border border-zinc-800 hover:border-zinc-400 hover:text-white hover:-translate-y-0.5 hover:shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)]",
    danger: "bg-red-500/5 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/10 hover:border-red-500 hover:-translate-y-0.5",
    ghost: "bg-transparent text-zinc-600 hover:text-white hover:bg-white/5"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : null}
      {children}
    </button>
  );
};
