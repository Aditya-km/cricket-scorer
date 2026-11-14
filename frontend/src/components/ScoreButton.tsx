import React from 'react';

interface ScoreButtonProps {
  label: string;
  sublabel?: string;
  variant?: 'run' | 'boundary' | 'extra' | 'wicket' | 'undo';
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}

export const ScoreButton: React.FC<ScoreButtonProps> = ({
  label,
  sublabel,
  variant = 'run',
  disabled = false,
  onClick,
  className = '',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'boundary':
        return 'bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20 active:scale-95 border-amber-400';
      case 'wicket':
        return 'bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-extrabold shadow-lg shadow-red-600/30 active:scale-95 border-red-500';
      case 'extra':
        return 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 hover:border-emerald-500/40 active:scale-95 shadow-sm font-bold';
      case 'undo':
        return 'bg-slate-800/80 hover:bg-slate-700 text-amber-300 border border-amber-500/30 hover:border-amber-400 active:scale-95 font-semibold';
      case 'run':
      default:
        return 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-600 active:scale-95 shadow-md font-bold';
    }
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl transition-all duration-150 border disabled:opacity-40 disabled:cursor-not-allowed select-none ${getVariantStyles()} ${className}`}
    >
      <span className="text-xl sm:text-2xl tracking-tight leading-none">{label}</span>
      {sublabel && (
        <span className="text-[10px] sm:text-xs opacity-75 mt-0.5 tracking-wider uppercase">
          {sublabel}
        </span>
      )}
    </button>
  );
};
