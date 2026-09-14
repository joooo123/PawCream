import { useMemo, useState } from 'react'
import {
  MAX_STAR_TRACKS,
  STAR_TUNING_DEFAULTS,
  type StarTrack,
  type StarTuning,
} from '../sceneConfig'
import '../tuneTrajectory.css'

type Props = {
  value: StarTuning
  onChange: (next: StarTuning) => void
  activeTrackIndex: number
  onActiveTrackChange: (index: number) => void
}

type NumericKey = Exclude<keyof StarTuning, 'tracks'>
type TrackKey = keyof StarTrack

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

type TrackRangeRowProps = {
  label: string
  field: TrackKey
  track: StarTrack
  onChange: (next: StarTrack) => void
  min: number
  max: number
  step: number
  suffix?: string
}

function formatNumber(value: number, step: number) {
  return step < 1 ? value.toFixed(step < 0.01 ? 3 : 2) : String(Math.round(value))
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
        {formatNumber(current, step)}{suffix}
      </output>
    </label>
  )
}

function TrackRangeRow({
  label,
  field,
  track,
  onChange,
  min,
  max,
  step,
  suffix = '',
}: TrackRangeRowProps) {
  const current = track[field]

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
            ...track,
            [field]: Number(event.currentTarget.value),
          })
        }
      />
      <output className="tune-row__value">
        {formatNumber(current, step)}{suffix}
      </output>
    </label>
  )
}

function cloneDefaults(): StarTuning {
  return {
    ...STAR_TUNING_DEFAULTS,
    tracks: STAR_TUNING_DEFAULTS.tracks.map((track) => ({ ...track })),
  }
}

export default function TunePanel({
  value,
  onChange,
  activeTrackIndex,
  onActiveTrackChange,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [copyStatus, setCopyStatus] = useState('复制参数')

  const safeTrackIndex = Math.min(
    Math.max(activeTrackIndex, 0),
    Math.max(0, value.tracks.length - 1),
  )
  const activeTrack = value.tracks[safeTrackIndex] ?? STAR_TUNING_DEFAULTS.tracks[0]

  const settingsText = useMemo(
    () => `STAR_TUNING_DEFAULTS = ${JSON.stringify(value, null, 2)}`,
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

  const updateActiveTrack = (nextTrack: StarTrack) => {
    onChange({
      ...value,
      tracks: value.tracks.map((track, index) =>
        index === safeTrackIndex ? nextTrack : track,
      ),
    })
  }

  const addTrack = () => {
    if (value.tracks.length >= MAX_STAR_TRACKS) return

    const direction = value.tracks.length % 2 === 0 ? -1 : 1
    const nextTrack: StarTrack = {
      ...activeTrack,
      curveX: activeTrack.curveX + 24,
      curveY: activeTrack.curveY + direction * 34,
      endX: activeTrack.endX + 36,
      endY: activeTrack.endY + direction * 52,
    }

    const nextIndex = value.tracks.length
    onChange({ ...value, tracks: [...value.tracks, nextTrack] })
    onActiveTrackChange(nextIndex)
  }

  const removeActiveTrack = () => {
    if (value.tracks.length <= 1) return

    const nextTracks = value.tracks.filter((_, index) => index !== safeTrackIndex)
    const nextIndex = Math.min(safeTrackIndex, nextTracks.length - 1)
    onChange({ ...value, tracks: nextTracks })
    onActiveTrackChange(nextIndex)
  }

  const reset = () => {
    onChange(cloneDefaults())
    onActiveTrackChange(0)
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
            多条轨道会同时显示。直接拖每条轨道的 curve / end 点即可改形状；拖任意轨道控制点时会自动选中该轨道。
          </p>

          <section className="tune-panel__section">
            <h2>出生位置</h2>
            <RangeRow label="X 偏移" field="spawnX" value={value} onChange={onChange} min={-80} max={140} step={1} suffix="px" />
            <RangeRow label="Y 偏移" field="spawnY" value={value} onChange={onChange} min={-80} max={120} step={1} suffix="px" />
          </section>

          <section className="tune-panel__section">
            <div className="tune-track-heading">
              <h2>多轨道</h2>
              <span>{value.tracks.length}/{MAX_STAR_TRACKS}</span>
            </div>

            <div className="tune-track-tabs" role="tablist" aria-label="星星轨道">
              {value.tracks.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={safeTrackIndex === index}
                  className={`tune-track-tab${safeTrackIndex === index ? ' is-active' : ''}`}
                  onClick={() => onActiveTrackChange(index)}
                >
                  轨道 {index + 1}
                </button>
              ))}
            </div>

            <div className="tune-track-actions">
              <button
                type="button"
                onClick={addTrack}
                disabled={value.tracks.length >= MAX_STAR_TRACKS}
              >
                + 新增轨道
              </button>
              <button
                type="button"
                onClick={removeActiveTrack}
                disabled={value.tracks.length <= 1}
              >
                删除当前
              </button>
            </div>

            <TrackRangeRow label="终点 X" field="endX" track={activeTrack} onChange={updateActiveTrack} min={40} max={520} step={1} suffix="px" />
            <TrackRangeRow label="终点 Y" field="endY" track={activeTrack} onChange={updateActiveTrack} min={-360} max={180} step={1} suffix="px" />
            <TrackRangeRow label="弯曲 X" field="curveX" track={activeTrack} onChange={updateActiveTrack} min={-120} max={420} step={1} suffix="px" />
            <TrackRangeRow label="弯曲 Y" field="curveY" track={activeTrack} onChange={updateActiveTrack} min={-360} max={220} step={1} suffix="px" />
          </section>

          <section className="tune-panel__section">
            <h2>飘逸感</h2>
            <RangeRow label="飞行时长" field="pathDurationMs" value={value} onChange={onChange} min={1800} max={12000} step={100} suffix="ms" />
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
            <RangeRow label="最多星星" field="maxStars" value={value} onChange={onChange} min={1} max={8} step={1} />
          </section>

          <div className="tune-panel__actions">
            <button type="button" onClick={copySettings}>{copyStatus}</button>
            <button type="button" onClick={reset}>恢复默认</button>
          </div>

          <p className="tune-panel__footnote">
            星星会轮流进入不同轨道，方便逐条观察。star-13 花环素材也已重新加入随机素材池。满意后复制参数发给我即可固化。
          </p>
        </div>
      )}
    </aside>
  )
}
