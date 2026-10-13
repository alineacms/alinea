import styler from '@alinea/styler'
import type {LabActions, ScenarioView} from './labEngine'
import css from './LabScenarios.module.scss'

const styles = styler(css)

const icons = {pass: '✓', fail: '✗', info: 'i', finding: '⚑'}

export interface LabScenariosProps {
  scenarios: Array<ScenarioView>
  busy: boolean
  actions: LabActions
}

function stateOf(scenario: ScenarioView) {
  const run = scenario.run
  if (!run) return 'idle'
  if (run.status === 'running') return 'running'
  if (run.checks.some(check => check.kind === 'fail')) return 'failed'
  if (run.checks.some(check => check.kind === 'finding')) return 'finding'
  return 'passed'
}

export function LabScenarios({scenarios, busy, actions}: LabScenariosProps) {
  const groups = [...new Set(scenarios.map(s => s.group))]
  return (
    <div className={styles.LabScenarios()}>
      {groups.map(group => (
        <section key={group} className={styles.LabScenarios.group()}>
          <h3 className={styles.LabScenarios.group.title()}>{group}</h3>
          {scenarios
            .filter(scenario => scenario.group === group)
            .map(scenario => {
              const state = stateOf(scenario)
              return (
                <article
                  key={scenario.id}
                  data-scenario={scenario.id}
                  className={styles.LabScenarios.scenario(state)}
                >
                  <button
                    type="button"
                    className={styles.LabScenarios.scenario.run()}
                    disabled={busy}
                    title={scenario.summary}
                    onClick={() => void actions.runScenario(scenario.id)}
                  >
                    <span className={styles.LabScenarios.scenario.icon()}>
                      {state === 'running' ? '…' : '▶'}
                    </span>
                    {scenario.title}
                  </button>
                  {scenario.run && (
                    <div className={styles.LabScenarios.scenario.result()}>
                      <p className={styles.LabScenarios.scenario.summary()}>
                        {scenario.summary}
                      </p>
                      {scenario.run.step && (
                        <p className={styles.LabScenarios.scenario.step()}>
                          {scenario.run.step}
                        </p>
                      )}
                      <ul className={styles.LabScenarios.checks()}>
                        {scenario.run.checks.map((check, index) => (
                          <li
                            key={index}
                            className={styles.LabScenarios.check(check.kind)}
                            title={check.detail}
                          >
                            <span className={styles.LabScenarios.check.icon()}>
                              {icons[check.kind]}
                            </span>
                            <span>
                              {check.label}
                              {check.detail && (
                                <span
                                  className={styles.LabScenarios.check.detail()}
                                >
                                  {' '}
                                  · {check.detail}
                                </span>
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
