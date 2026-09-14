import { useMemo, useState } from 'react'
import {
  STAR_TUNING_DEFAULTS,
  type StarTuning,
} from '../sceneConfig'

type Props = {
  value: StarTuning
  onChange: (next: StarTuning) => void
}

type NumericKey = keyof StarTuning

type RangeRowProps = {
  label: string
  field: NumericKey
  value: StarTuning
  onChange: (next: StarTuning) => void
  min: number
  max: number
  step: number
  suffix?: string
}

function RangeRow({
  label,
  field,
  value,
  onChange,
  min,
  max,
  step,
  suffix = '',
}: RangeRowProps) {
  const current = value[field]

  return (
    <label className="tune-row">
      <span className="tune-row__label">{label}</span>
      <input
        className="tune-row__range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(event) =>
          onChange({
            ...value,
            [field]: Number(event.currentTarget.value),
          })
        }
      />
      <output className="tune-row__value">
        {step < 1 ? current.toFixed(2) : Math.round(current)}{suffix}
      </output>
    </label>
  )
}

export default function TunePanel({ value, onChange }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [copyStatus, setCopyStatus] = useState('复制参数')

  const settingsText = useMemo(
    () =>
      `STAR_TUNING_DEFAULTS = ${JSON.stringify(value, null, 2)}`,
    [value],
  )

  const copySettings = async () => {
    try {
      await navigator.clipboard.writeText(settingsText)
      setCopyStatus('已复制')
      window.setTimeout(() => setCopyStatus('复制参数'), 1200)
    } catch {
      setCopyStatus('复制失败')
      window.setTimeout(() => setCopyStatus('复制参数'), 1600)
    }
  }

  return (
    <aside className={`tune-panel${collapsed ? ' tune-panel--collapsed' : ''}`}>
      <header className="tune-panel__header">
        <div>
          <strong>PawCream Tune</strong>
          <span>?tune=1</span>
        </div>
        <button
          type="button"
          className="tune-panel__collapse"
          onClick={() => setCollapsed((current) => !current)}
          aria-label={collapsed ? '展开调参面板' : '收起调参面板'}
        >
          {collapsed ? '+' : '−'}
        </button>
      </header>

      {!collapsed && (
        <div className="tune-panel__body">
          <p className="tune-panel__hint">
            拖动画面中的粉色准星可直接调整出生位置；其它参数用滑块实时预览。
          </p>

          <section className="tune-panel__section">
            <h2>出生位置</h2>
            <RangeRow label="X 偏移" field="spawnX" value={value} onChange={onChange} min={-80} max={140} step={1} suffix="px" />
            <RangeRow label="Y 偏移" field="spawnY" value={value} onChange={onChange} min={-80} max={120} step={1} suffix="px" />
          </section>

          <section className="tune-panel__section">
            <h2>尺寸</h2>
            <RangeRow label="最小尺寸" field="sizeMin" value={value} onChange={onChange} min={20} max={120} step={1} suffix="px" />
            <RangeRow label="最大尺寸" field="sizeMax" value={value} onChange={onChange} min={24} max={150} step={1} suffix="px" />
            <RangeRow label="出生比例" field="birthScale" value={value} onChange={onChange} min={0.1} max={1} step={0.01} />
          </section>

          <section className="tune-panel__section">
            <h2>运动</h2>
            <RangeRow label="右漂最慢" field="driftMin" value={value} onChange={onChange} min={0} max={2} step={0.01} />
            <RangeRow label="右漂最快" field="driftMax" value={value} onChange={onChange} min={0} max={2} step={0.01} />
            <RangeRow label="上升最慢" field="riseMax" value={value} onChange={onChange} min={-1} max={0} step={0.01} />
            <RangeRow label="上升最快" field="riseMin" value={value} onChange={onChange} min={-1} max={0} step={0.01} />
          </section>

          <section className="tune-panel__section">
            <h2>节奏</h2>
            <RangeRow label="最短间隔" field="spawnMinMs" value={value} onChange={onChange} min={400} max={6000} step={100} suffix="ms" />
            <RangeRow label="最长间隔" field="spawnMaxMs" value={value} onChange={onChange} min={500} max={8000} step={100} suffix="ms" />
            <RangeRow label="最多星星" field="maxStars" value={value} onChange={onChange} min={1} max={6} step={1} />
          </section>

          <div className="tune-panel__actions">
            <button type="button" onClick={copySettings}>{copyStatus}</button>
            <button
              type="button"
              onClick={() => onChange({ ...STAR_TUNING_DEFAULTS })}
            >
              恢复默认
            </button>
          </div>

          <p className="tune-panel__footnote">
            调参值只保存在当前浏览器，不会修改正式页面。满意后把“复制参数”的内容发给我即可固化。
          </p>
        </div>
      )}
    </aside>
  )
}
