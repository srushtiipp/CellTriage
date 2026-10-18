import { Fragment } from 'react'

/**
 * Minimal, safe markdown: headings, bold, italic, inline code, bullet and numbered
 * lists, paragraphs. It builds React elements (never raw HTML) and renders no links
 * or images, so model output can not inject markup or navigate the user.
 */
const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g

function inline(text, keyBase) {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyBase}-${i}`
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={key} className="font-semibold text-text-primary">{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={key} className="rounded bg-app-surface2 px-1 py-0.5 font-mono text-[12px]">{part.slice(1, -1)}</code>
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={key}>{part.slice(1, -1)}</em>
    return <Fragment key={key}>{part}</Fragment>
  })
}

export function parseBlocks(src) {
  const blocks = []
  let list = null
  const flush = () => {
    if (list) blocks.push(list)
    list = null
  }
  for (const raw of String(src ?? '').replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd()
    let m
    if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
      if (!list || list.type !== 'ul') { flush(); list = { type: 'ul', items: [] } }
      list.items.push(m[1])
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      if (!list || list.type !== 'ol') { flush(); list = { type: 'ol', items: [] } }
      list.items.push(m[1])
    } else if ((m = line.match(/^#{1,4}\s+(.*)$/))) {
      flush()
      blocks.push({ type: 'h', text: m[1] })
    } else if (line.trim()) {
      flush()
      blocks.push({ type: 'p', text: line.trim() })
    } else {
      flush()
    }
  }
  flush()
  return blocks
}

export default function Markdown({ children }) {
  return (
    <div className="space-y-2.5 text-[13.5px] leading-relaxed text-text-secondary">
      {parseBlocks(children).map((b, i) => {
        if (b.type === 'h') return <h3 key={i} className="pt-1 text-sm font-semibold text-text-primary">{inline(b.text, i)}</h3>
        if (b.type === 'ul') return <ul key={i} className="list-disc space-y-1 pl-5">{b.items.map((t, j) => <li key={j}>{inline(t, `${i}-${j}`)}</li>)}</ul>
        if (b.type === 'ol') return <ol key={i} className="list-decimal space-y-1 pl-5">{b.items.map((t, j) => <li key={j}>{inline(t, `${i}-${j}`)}</li>)}</ol>
        return <p key={i}>{inline(b.text, i)}</p>
      })}
    </div>
  )
}
