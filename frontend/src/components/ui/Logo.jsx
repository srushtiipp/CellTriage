export default function Logo({ className = 'h-11' }) {
  return (
    <>
      <img src="/celltriage-logo-light.png" alt="CellTriage" className={`block w-auto shrink-0 self-start object-contain dark:hidden ${className}`} />
      <img src="/celltriage-logo-dark.png" alt="CellTriage" className={`hidden w-auto shrink-0 self-start object-contain dark:block ${className}`} />
    </>
  )
}
