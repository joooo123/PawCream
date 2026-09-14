type Props = {
  onBack: () => void
}

export default function AtelierPlaceholder({ onBack }: Props) {
  return (
    <main className="atelier-placeholder">
      <section className="atelier-card" aria-label="Atelier placeholder">
        <p className="atelier-kicker">PawCream</p>
        <h1>Atelier Room</h1>
        <p>
          Home → Atelier 的过渡已经打通。下一阶段再替换为你的正式 Atelier 插画场景。
        </p>
        <button type="button" onClick={onBack}>
          Back home
        </button>
      </section>
    </main>
  )
}
