import { FolderOpen, Upload } from 'lucide-react';
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
        'dz group cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void',
        isDragging && 'dz-active',
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
        <div className="absolute inset-0 rounded-[inherit] flex items-center justify-center
                        bg-gradient-to-br from-accent/20 via-transparent to-teal/20
                        backdrop-blur-sm z-10 animate-fade-in">
          <div className="text-center">
            <Upload size={34} className="text-accent-light mx-auto mb-3 animate-bounce-sm" aria-hidden />
            <p className="text-bright font-semibold text-sm">Drop to add files</p>
          </div>
        </div>
      )}

      <div className={cn(
        'flex flex-col items-center justify-center py-14 px-6 text-center pointer-events-none',
        'transition-opacity duration-200',
        isDragging && 'opacity-0',
      )}>
        {/* Icon cluster */}
        <div className="relative mb-6">
          <span aria-hidden className="absolute inset-0 rounded-3xl border border-accent/40 animate-ring-pulse" />
          <span aria-hidden className="absolute inset-0 rounded-3xl border border-accent/30 animate-ring-pulse"
                style={{ animationDelay: '1.4s' }} />
          <div className="glass-raised relative w-[72px] h-[72px] rounded-3xl flex items-center justify-center
                          animate-float group-hover:scale-105 transition-transform duration-500 ease-spring">
            <Upload size={28} className="text-accent-light" aria-hidden />
          </div>
        </div>

        <p className="text-bright font-semibold mb-1.5 text-base tracking-tight">
          Drag &amp; drop files or folders
        </p>
        <p className="text-muted text-sm mb-6 leading-relaxed">
          All formats · Up to {formatBytes(APP_CONFIG.MAX_FILE_SIZE)} per file
        </p>

        <div
          className="flex items-center gap-2 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <Button variant="primary" size="md" onClick={openPicker} disabled={disabled}>
            <Upload size={14} aria-hidden />
            Select Files
          </Button>
          <Button
            variant="outline" size="md" disabled={disabled}
            onClick={() => document.getElementById('folder-input')?.click()}
          >
            <FolderOpen size={14} aria-hidden />
            Folder
          </Button>
        </div>
      </div>
    </div>
  );
}
