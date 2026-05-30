const write = (level, message, metadata) => {
  const payload = metadata === undefined ? '' : ` ${JSON.stringify(metadata)}`
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}${payload}`

  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line)
    return
  }

  if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(line)
    return
  }

  // eslint-disable-next-line no-console
  console.log(line)
}

export const LOGGER = {
  info: (message, metadata) => write('info', message, metadata),
  warn: (message, metadata) => write('warn', message, metadata),
  error: (message, metadata) => write('error', message, metadata)
}
