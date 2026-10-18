import { cn } from '@/lib/utils';

/**
 * Segmented — glass segmented control with a sliding thumb.
 * Fully keyboard accessible (radiogroup + arrow keys).
 *
 * @param {Array}    options  - [{ id, label, icon?, disabled? }]
 * @param {*}        value    - id of the active option
 * @param {Function} onChange - called with the new id
 */
export function Segmented({ options, value, onChange, label, size = 'md', className }) {
  const count = options.length;
  const found = options.findIndex((o) => o.id === value);
  const idx   = Math.max(0, found);

  function onKeyDown(e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    for (let step = 1; step <= count; step++) {
      const next = options[(idx + dir * step + count * 2) % count];
      if (!next.disabled) { onChange(next.id); break; }
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('seg relative grid p-1 rounded-2xl', className)}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="seg-thumb absolute top-1 bottom-1 left-1 rounded-xl transition-[transform,opacity] duration-500 ease-spring"
        style={{
          width: `calc((100% - 0.5rem) / ${count})`,
          transform: `translateX(${idx * 100}%)`,
          opacity: found === -1 ? 0 : 1,
        }}
      />
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.id)}
            className={cn(
              'relative z-10 inline-flex items-center justify-center gap-2 rounded-xl font-medium',
              'transition-colors duration-200 select-none whitespace-nowrap',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
              size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
              active ? 'text-bright' : 'text-muted hover:text-text',
              o.disabled && 'opacity-40 cursor-not-allowed',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
