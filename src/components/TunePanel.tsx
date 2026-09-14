import { useMemo, useState } from 'react'
import {
  STAR_TUNING_DEFAULTS,
  type StarTuning,
} from '../sceneConfig'
import '../tuneTrajectory.css'

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
        {step < 1 ? current.toFixed(step < 0.01 ? 3 : 2) : Math.round(current)}{suffix}
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
            直接拖动画面中的 spawn / curve / end 三个点来设计轨迹；滑块负责细调飘逸感、尺寸和节奏。
          </p>

          <section className="tune-panel__section">
            <h2>出生位置</h2>
            <RangeRow label="X 偏移" field="spawnX" value={value} onChange={onChange} min={-80} max={140} step={1} suffix="px" />
            <RangeRow label="Y 偏移" field="spawnY" value={value} onChange={onChange} min={-80} max={120} step={1} suffix="px" />
          </section>

          <section className="tune-panel__section">
            <h2>轨迹形状</h2>
            <RangeRow label="终点 X" field="pathEndX" value={value} onChange={onChange} min={40} max={520} step={1} suffix="px" />
            <RangeRow label="终点 Y" field="pathEndY" value={value} onChange={onChange} min={-360} max={180} step={1} suffix="px" />
            <RangeRow label="弯曲 X" field="pathCurveX" value={value} onChange={onChange} min={-120} max={420} step={1} suffix="px" />
            <RangeRow label="弯曲 Y" field="pathCurveY" value={value} onChange={onChange} min={-360} max={220} step={1} suffix="px" />
            <RangeRow label="飞行时长" field="pathDurationMs" value={value} onChange={onChange} min={1800} max={12000} step={100} suffix="ms" />
          </section>

          <section className="tune-panel__section">
            <h2>飘逸感</h2>
            <RangeRow label="摆动幅度" field="wobbleAmp" value={value} onChange={onChange} min={0} max={40} step={0.5} suffix="px" />
            <RangeRow label="摆动频率" field="wobbleFreq" value={value} onChange={onChange} min={0.002} max={0.04} step={0.001} />
            <RangeRow label="轨迹散开" field="laneSpread" value={value} onChange={onChange} min={0} max={80} step={1} suffix="px" />
          </section>

          <section className="tune-panel__section">
            <h2>尺寸</h2>
            <RangeRow label="最小尺寸" field="sizeMin" value={value} onChange={onChange} min={20} max={120} step={1} suffix="px" />
            <RangeRow label="最大尺寸" field="sizeMax" value={value} onChange={onChange} min={24} max={150} step={1} suffix="px" />
            <RangeRow label="出生比例" field="birthScale" value={value} onChange={onChange} min={0.1} max={1} step={0.01} />
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
            粉色虚线就是主轨迹。curve 控制弧线怎么拐，end 控制最终飘到哪里；参数只保存在当前浏览器。
          </p>
        </div>
      )}
    </aside>
  )
}
