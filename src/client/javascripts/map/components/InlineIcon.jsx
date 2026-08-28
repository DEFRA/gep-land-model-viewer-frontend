export function InlineIcon ({ className, content }) {
  return (
    <svg
      className={className}
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      focusable='false'
      aria-hidden='true'
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}
