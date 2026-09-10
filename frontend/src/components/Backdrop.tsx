/** Quiet ambient background: two slowly drifting warm gradients and a faint line texture. */
export function Backdrop() {
  return (
    <div className="ambient" aria-hidden="true">
      <div className="ambient-lines" />
    </div>
  )
}
