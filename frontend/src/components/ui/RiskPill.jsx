import StatusPill from './StatusPill'
import { riskInfo } from '../../lib/risk'

export default function RiskPill({ level }) {
  const info = riskInfo(level)
  return <StatusPill tone={info.tone}>{info.label}</StatusPill>
}
