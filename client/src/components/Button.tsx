import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'quiet';
const styles: Record<Variant, string> = {
  primary: 'bg-azul-plano text-white hover:bg-azul-oscuro',
  secondary: 'bg-superficie text-tinta border-acero hover:bg-azul-tinte',
  danger: 'bg-rojo-paro text-white hover:bg-rojo-texto',
  quiet: 'bg-transparent text-azul-plano hover:bg-azul-tinte',
};

export function Button({ variant = 'primary', icon, children, className = '', ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: ReactNode }) {
  return (
    <button
      {...rest}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-transparent px-4 py-2 text-[15px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-borde-suave disabled:text-acero ${styles[variant]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}
