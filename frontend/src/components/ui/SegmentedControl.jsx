export default function SegmentedControl({ options, value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap rounded-md border border-app-border bg-app-surface2 p-0.5">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`hover-edge rounded px-2.5 py-1 text-xs font-medium ${
              active ? 'bg-app-surface text-text-primary shadow-subtle' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
