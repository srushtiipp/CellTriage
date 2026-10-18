/**
 * DataTable: compact, scrollable, keyboard-accessible table.
 * columns: [{ key, label, align: 'left'|'right', render?(row), className? }]
 * Rows are selectable when onRowClick is given (each row has a focusable button in its first cell).
 */
export default function DataTable({ columns, rows, rowKey, selectedKey, onRowClick, maxHeight, caption, emptyText = 'No records.' }) {
  if (!rows.length) return <p className="px-1 py-6 text-center text-[13px] text-text-muted">{emptyText}</p>
  return (
    <div className="overflow-auto rounded-md border border-app-border" style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full min-w-max border-collapse text-[13px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="sticky top-0 z-[1] bg-app-surface2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`whitespace-nowrap px-3 py-2.5 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const k = rowKey(row)
            const selected = selectedKey !== undefined && selectedKey === k
            return (
              <tr
                key={k}
                aria-selected={onRowClick ? selected : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-t border-app-borderMuted ${onRowClick ? 'cursor-pointer hover:bg-app-surface2' : ''} ${selected ? 'bg-accent-dim' : ''}`}
              >
                {columns.map((c, i) => {
                  const content = c.render ? c.render(row) : row[c.key]
                  return (
                    <td key={c.key} className={`whitespace-nowrap px-3 py-2 tabular ${c.align === 'right' ? 'text-right' : 'text-left'} ${c.className || ''}`}>
                      {onRowClick && i === 0 ? (
                        <button type="button" onClick={(e) => { e.stopPropagation(); onRowClick(row) }} className="font-medium text-text-primary hover:underline">
                          {content}
                        </button>
                      ) : (
                        content
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
