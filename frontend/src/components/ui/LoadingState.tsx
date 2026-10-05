import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  text?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message,
  text,
}) => {
  const display = text || message || 'Loading...';

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {display}
      </p>
    </div>
  );
};
