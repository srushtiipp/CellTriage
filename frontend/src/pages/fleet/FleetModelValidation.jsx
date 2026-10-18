import { CheckCircle, Info, XCircle } from 'lucide-react'
import Card from '../../components/ui/Card'
import CardHeader from '../../components/ui/CardHeader'
import Notice from '../../components/ui/Notice'
import PageHeader from '../../components/ui/PageHeader'

/**
 * FleetModelValidation — presents the documented evaluation evidence for the
 * CellTriage session-health model.
 *
 * These figures are from the project's reconstruction of a chronological
 * test split (the "temporal split" evaluation):
 *   Test set: 2,473 sessions from 15 of the 20 fleet vehicles
 *   Model MAE: 1.969 %  RMSE: 3.332 %
 *   Baseline (last-known-SOH) MAE: 4.350 %  RMSE: 7.670 %
 *
 * Only include what the project documentation explicitly supports.
 * RUL is not presented as validated.
 */

function MetricBox({ label, value, unit, sub, highlight }) {
  return (
    <div className={`flex flex-col rounded-card border px-4 py-3 ${highlight ? 'border-accent/40 bg-accent-dim' : 'border-app-border bg-app-surface2'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{label}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-2xl font-semibold tabular ${highlight ? 'text-accent-strong' : 'text-text-primary'}`}>{value}</span>
        {unit && <span className="text-sm text-text-secondary">{unit}</span>}
      </div>
      {sub && <p className="mt-1 text-[11px] text-text-muted">{sub}</p>}
    </div>
  )
}

function SupportedItem({ children }) {
  return (
    <li className="flex items-start gap-2 text-[13px] text-text-secondary">
      <CheckCircle size={14} className="mt-0.5 shrink-0 text-status-good" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

function UnsupportedItem({ children }) {
  return (
    <li className="flex items-start gap-2 text-[13px] text-text-secondary">
      <XCircle size={14} className="mt-0.5 shrink-0 text-text-muted" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

export default function FleetModelValidation() {
  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Model Validation"
        subtitle="Evaluation evidence for the session health-index model used in CellTriage."
      />

      <Notice tone="info" title="How to read this page">
        This page presents documented evaluation results for the machine-learning model that produces the session-estimated health index.
        All figures are from a retrospective chronological test split, not live API metrics.
        Results labelled "not validated" are either unsupported or deliberately omitted to avoid misleading the reader.
      </Notice>

      {/* Evaluation protocol */}
      <Card radius="cardLg" className="p-5">
        <CardHeader title="Evaluation protocol" subtitle="How the test was constructed" />
        <dl className="mt-4 space-y-3">
          {[
            ['Test design', 'Chronological (temporal) split — training on earlier sessions, testing on later sessions to respect time ordering. Note: this tests time-series hold-out on the same 15 vehicles, not generalization to unseen vehicles.'],
            ['Test set size', '2,473 sessions from 15 of the 20 fleet vehicles.'],
            ['Vehicles in test', '15 vehicles contributed test sessions. The remaining 5 vehicles were not included in this test set.'],
            ['Unseen-vehicle generalization', 'Not established. The evaluation does not use a leave-one-group-out (vehicle hold-out) split, so performance on unseen vehicles remains unverified.'],
            ['Reference capacity', '135 Ah (fixed). The health index is calibrated against this reference; values above 100% indicate recorded session throughput exceeded 135 Ah per 100% ΔSOC.'],
            ['Target variable', 'Session-level State of Health (SOH), calculated via Coulomb counting ((∫|I|dt) / ΔSOC) expressed as a percentage of the fixed 135 Ah reference.'],
          ].map(([term, def]) => (
            <div key={term} className="grid grid-cols-1 gap-1 border-b border-app-borderMuted pb-3 last:border-0 last:pb-0 sm:grid-cols-3 sm:gap-4">
              <dt className="text-[13px] font-semibold text-text-primary sm:col-span-1">{term}</dt>
              <dd className="text-[13px] text-text-secondary sm:col-span-2">{def}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Feature Dependence and Leakage Disclosure */}
      <Card radius="cardLg" className="p-5 border-warn/30 bg-warn-dim/20">
        <CardHeader
          title="Methodological disclosure: Feature dependence and target overlap"
          subtitle="Critical technical context for model interpretation"
        />
        <div className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-text-secondary">
          <p>
            The training target (<code className="font-mono text-text-primary">estimated_SOH</code>) is mathematically derived from charging-session quantities via direct Coulomb counting:
            the net charge throughput divided by the change in SOC (<code className="font-mono text-text-primary">ΔSOC = end_soc − start_soc</code>) relative to the 135 Ah reference.
          </p>
          <p>
            The trained model uses session input features that include <code className="font-mono text-text-primary">duration_minutes</code>, <code className="font-mono text-text-primary">start_soc</code>, <code className="font-mono text-text-primary">end_soc</code>, <code className="font-mono text-text-primary">delta_soc</code>, <code className="font-mono text-text-primary">current_mean</code>, and <code className="font-mono text-text-primary">C_rate_mean</code>.
          </p>
          <p className="font-medium text-warn-strong">
            Because the target is constructed directly from current, duration, and ΔSOC, several input features overlap mathematically with the target derivation.
            This creates a feature-dependence / feature-leakage concern that limits claims about independent physical degradation learning.
            The model should be understood as approximating session-level charge throughput rather than predicting intrinsic electrochemical degradation from independent aging mechanisms.
          </p>
        </div>
      </Card>

      {/* Model performance metrics */}
      <Card radius="cardLg" className="p-5">
        <CardHeader
          title="Model performance on the test set"
          subtitle="Evaluated on 2,473 held-out sessions (chronological split across 15 vehicles)"
        />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricBox label="Model MAE" value="1.969" unit="%" sub="Mean absolute error" highlight />
          <MetricBox label="Model RMSE" value="3.332" unit="%" sub="Root mean square error" highlight />
          <MetricBox label="Baseline MAE" value="4.350" unit="%" sub="Last-known-SOH" />
          <MetricBox label="Baseline RMSE" value="7.670" unit="%" sub="Last-known-SOH" />
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-text-secondary">
          The baseline is the standard "last-known-SOH" persistence predictor: for each session, predict the SOH recorded in the previous session.
          The model achieves a <strong>55% reduction in MAE</strong> and a <strong>57% reduction in RMSE</strong> relative to this baseline on the chronological test set.
        </p>
        <Notice tone="warn" className="mt-4" title="Important evaluation caveats">
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>No unseen-vehicle validation:</strong> The test set covers 15 of 20 vehicles. Performance on the 5 unseen vehicles is not characterised. Generalisation to unseen vehicles has not been demonstrated.</li>
            <li><strong>Feature overlap:</strong> As disclosed above, input features overlap with the Coulomb-counting derivation of the target.</li>
            <li><strong>Single fleet cohort:</strong> All sessions are from the same fleet under similar operating conditions. Generalisation to other fleets or cell chemistries has not been tested.</li>
            <li><strong>Units:</strong> Error magnitudes are in percentage points of the 135 Ah reference, not in absolute battery capacity (Ah).</li>
            <li><strong>No RUL:</strong> Remaining Useful Life (RUL) is not modelled or predicted.</li>
          </ul>
        </Notice>
      </Card>

      {/* What is and is not validated */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card radius="cardLg" className="p-5">
          <CardHeader title="What is validated" />
          <ul className="mt-4 space-y-2.5">
            <SupportedItem>Session-level health index estimation against a fixed 135 Ah reference</SupportedItem>
            <SupportedItem>MAE (1.969%) and RMSE (3.332%) on a chronological test set of 2,473 sessions across 15 vehicles</SupportedItem>
            <SupportedItem>Comparison against a documented last-known-SOH baseline on the same test set</SupportedItem>
            <SupportedItem>Risk classification (low / medium / high / critical) applied by backend rules</SupportedItem>
            <SupportedItem>EFC-based session sequencing as an operational proxy for pack cycling</SupportedItem>
          </ul>
        </Card>
        <Card radius="cardLg" className="p-5">
          <CardHeader title="What is not validated / not supported" />
          <ul className="mt-4 space-y-2.5">
            <UnsupportedItem>Generalisation to unseen vehicles — 5 vehicles absent; no group hold-out test</UnsupportedItem>
            <UnsupportedItem>Remaining Useful Life (RUL) — not modelled, not presented anywhere in CellTriage</UnsupportedItem>
            <UnsupportedItem>Independent physical degradation prediction — features overlap with target derivation</UnsupportedItem>
            <UnsupportedItem>Cell-level voltages or temperatures — not fabricated; only pack-level telemetry exists</UnsupportedItem>
            <UnsupportedItem>Calendar-aligned degradation rates — sessions lack reliable timestamps</UnsupportedItem>
            <UnsupportedItem>Generalisation to other fleets, cell chemistries, or operating profiles</UnsupportedItem>
            <UnsupportedItem>R² score — not reported in project documentation and deliberately omitted</UnsupportedItem>
          </ul>
        </Card>
      </div>

      {/* Data source note */}
      <Card radius="cardLg" className="p-5">
        <CardHeader title="Data source and methodology notes" />
        <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-text-secondary">
          <p>
            The CellTriage model was trained and evaluated on session-level battery data recorded from the project fleet.
            Input features are derived from pack-level telemetry (voltage, current, temperature, state of charge, equivalent full cycles)
            recorded during charging sessions.
          </p>
          <p>
            The chronological split was used to test time-ordered hold-out performance. However, because test sessions come from the same
            15 vehicles present in the training set, it does not evaluate how the model would perform on an entirely new vehicle.
          </p>
          <p>
            Health index values that exceed 100% reflect sessions where the Coulomb-counted capacity exceeded the 135 Ah nominal reference.
            These values do not indicate superhuman battery health, nor does a low value prove cell failure without physical teardown or independent inspection.
          </p>
          <p className="flex items-start gap-2 rounded-card border border-app-border bg-app-surface2 px-3 py-2">
            <Info size={14} className="mt-0.5 shrink-0 text-text-muted" aria-hidden="true" />
            <span>
              These evaluation results reflect the state of the model at the time of the project evaluation.
              The model parameters, weights, and evaluation metrics have been preserved without modification.
            </span>
          </p>
        </div>
      </Card>
    </div>
  )
}
