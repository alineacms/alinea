import {lab} from '../world/lab.js'
import {
  runScenario,
  runs,
  type Scenario,
  scenarios
} from '../world/scenarios.js'
import {useBus} from './useBus.js'

const icons = {pass: '✓', fail: '✗', info: 'i', finding: '⚑'}

export function Scenarios({onRun}: {onRun(scenario: Scenario): void}) {
  useBus()
  const groups = [...new Set(scenarios.map(s => s.group))]
  return (
    <div className="scenarios">
      {groups.map(group => (
        <section key={group}>
          <h3>{group}</h3>
          {scenarios
            .filter(s => s.group === group)
            .map(scenario => {
              const run = runs[scenario.id]
              const failed = run?.checks.some(c => c.kind === 'fail')
              const findings = run?.checks.some(c => c.kind === 'finding')
              const state = !run
                ? 'idle'
                : run.status === 'running'
                  ? 'running'
                  : failed
                    ? 'failed'
                    : findings
                      ? 'finding'
                      : 'passed'
              return (
                <article
                  key={scenario.id}
                  className={`scenario scenario-${state}`}
                  data-scenario={scenario.id}
                >
                  <button
                    type="button"
                    className="scenario-run"
                    disabled={lab.busy}
                    onClick={() => {
                      onRun(scenario)
                      void runScenario(scenario)
                    }}
                    title={scenario.summary}
                  >
                    <span className="scenario-state">
                      {state === 'running' ? '…' : '▶'}
                    </span>
                    <span>{scenario.title}</span>
                  </button>
                  {run && (
                    <div className="scenario-result">
                      <p className="muted">{scenario.summary}</p>
                      {run.step && <p className="scenario-step">{run.step}</p>}
                      <ul className="checks">
                        {run.checks.map((check, index) => (
                          <li
                            key={index}
                            className={`check check-${check.kind}`}
                            title={check.detail}
                          >
                            <span className="check-icon">
                              {icons[check.kind]}
                            </span>
                            <span>
                              {check.label}
                              {check.detail && (
                                <span className="muted"> · {check.detail}</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              )
            })}
        </section>
      ))}
    </div>
  )
}

export async function runAll() {
  for (const scenario of scenarios) await runScenario(scenario)
}
