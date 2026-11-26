/**
 * Two people, one film. Each circle is a person; where they overlap is what
 * they share. The overlap takes the ink colour so it reads on any canvas.
 */
export default function BrandMark({ title }: { title?: string }) {
  return <svg aria-hidden={title ? undefined : true} aria-label={title} focusable="false" role={title ? 'img' : undefined} viewBox="0 0 30 21" xmlns="http://www.w3.org/2000/svg">
    {title && <title>{title}</title>}
    <circle cx="10.5" cy="10.5" fill="var(--m-person-1)" r="10" />
    <circle cx="19.5" cy="10.5" fill="var(--m-person-5)" r="10" />
    <path d="M15 1.57a10 10 0 0 1 0 17.86a10 10 0 0 1 0 -17.86Z" fill="var(--m-color-ink)" />
  </svg>;
}
