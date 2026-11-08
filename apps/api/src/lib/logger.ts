export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 }

export type Logger = {
  debug: (msg: string, data?: Record<string, unknown>) => void
  info: (msg: string, data?: Record<string, unknown>) => void
  warn: (msg: string, data?: Record<string, unknown>) => void
  error: (msg: string, data?: Record<string, unknown>) => void
}

export function createLogger(level: LogLevel, json = false): Logger {
  const emit = (lvl: Exclude<LogLevel, 'silent'>, msg: string, data?: Record<string, unknown>) => {
    if (order[lvl] < order[level]) return
    if (json) {
      console.log(JSON.stringify({ level: lvl, msg, time: new Date().toISOString(), ...data }))
      return
    }
    const extra = data && Object.keys(data).length ? ` ${JSON.stringify(data)}` : ''
    const line = `[api] ${lvl.padEnd(5)} ${msg}${extra}`
    if (lvl === 'error') console.error(line)
    else if (lvl === 'warn') console.warn(line)
    else console.log(line)
  }
  return {
    debug: (m, d) => emit('debug', m, d),
    info: (m, d) => emit('info', m, d),
    warn: (m, d) => emit('warn', m, d),
    error: (m, d) => emit('error', m, d),
  }
}

export const silentLogger = createLogger('silent')
