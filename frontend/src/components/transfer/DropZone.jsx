import { FolderOpen, Upload, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDropZone } from '@/hooks/useDropZone';
import { Button } from '@/components/ui/Button';
import { formatBytes } from '@/lib/utils';
import { APP_CONFIG } from '@shared/constants';

export function DropZone({ onFiles, disabled, className }) {
  const { isDragging, dropZoneProps, inputRef, openPicker, onInputChange } = useDropZone({
    onFiles, disabled,
  });

  return (
    <div
      {...dropZoneProps}
      className={cn(
        'relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer group',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        isDragging
          ? 'border-accent bg-accent-muted scale-[1.01] shadow-glow'
          : 'border-border hover:border-border-bright hover:bg-surface/40',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
      onClick={!disabled ? openPicker : undefined}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Drop files here, or click to select files"
      aria-disabled={disabled}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) openPicker(); }}
    >
      {/* Hidden inputs */}
      <input ref={inputRef} type="file" multiple className="sr-only"
        onChange={onInputChange} tabIndex={-1} aria-hidden />
      <input id="folder-input" type="file"
        /* @ts-ignore */ webkitdirectory="" multiple className="sr-only"
        onChange={onInputChange} tabIndex={-1} aria-hidden />

      {/* Drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 rounded-2xl flex items-center justify-center
                        bg-accent-muted/50 backdrop-blur-sm z-10 animate-fade-in">
          <div className="text-center">
            <Upload size={32} className="text-accent mx-auto mb-2 animate-bounce-sm" />
            <p className="text-accent font-semibold text-sm">Drop to add files</p>
          </div>
        </div>
      )}

      <div className={cn(
        'flex flex-col items-center justify-center py-12 px-6 text-center pointer-events-none',
        'transition-opacity duration-200',
        isDragging && 'opacity-0',
      )}>
        {/* Icon cluster */}
        <div className="relative mb-5">
          <div className={cn(
            'w-16 h-16 rounded-2xl border flex items-center justify-center transition-all duration-300',
            'group-hover:scale-110 group-hover:shadow-glow-sm',
            'bg-surface border-border group-hover:border-accent/40 group-hover:bg-accent-muted',
          )}>
            <Upload size={26} className="text-muted group-hover:text-accent transition-colors duration-300" />
          </div>
          {/* Sparkle decoration */}
          <Sparkles
            size={14}
            className="absolute -top-1 -right-1 text-accent opacity-0 group-hover:opacity-100
                       transition-opacity duration-300 animate-pulse-slow"
            aria-hidden
          />
        </div>

        <p className="text-text font-semibold mb-1.5 text-sm">
          Drag &amp; drop files or folders
        </p>
        <p className="text-muted text-xs mb-5 leading-relaxed">
          All formats · Up to {formatBytes(APP_CONFIG.MAX_FILE_SIZE)} per file
        </p>

        <div
          className="flex items-center gap-2 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="outline" size="sm" onClick={openPicker} disabled={disabled}
            className="h-8"
          >
            <Upload size={12} />
            Select Files
          </Button>
          <Button
            variant="ghost" size="sm" disabled={disabled}
            onClick={() => document.getElementById('folder-input')?.click()}
            className="h-8"
          >
            <FolderOpen size={12} />
            Folder
          </Button>
        </div>
      </div>
    </div>
  );
}
