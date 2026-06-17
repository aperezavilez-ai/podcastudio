import React, { useEffect, useRef, useState } from 'react'
import styles from './VUMeter.module.css'

export default function VUMeter({ level = 0, bars = 16 }) {
  const [levels, setLevels] = useState(Array(bars).fill(0))

  useEffect(() => {
    setLevels(prev => prev.map((_, i) => {
      const base = level * (1 - i * 0.04)
      return Math.max(0, Math.min(100, base + (Math.random() - 0.5) * 15))
    }))
  }, [level, bars])

  return (
    <div className={styles.meter}>
      {levels.map((lv, i) => (
        <div key={i} className={styles.bar} style={{ height: `${Math.max(8, lv)}%` }}
          data-warn={lv > 75 ? 'true' : undefined}
          data-clip={lv > 90 ? 'true' : undefined}
        />
      ))}
    </div>
  )
}
