const debug = true
export const bigLabel = (title, ...rest) => {
  const f = rest.pop()
  if (!debug || !title) return f()
  const margin = 44
  console.group(`
╭${'─'.repeat(margin)}────${title.replace(/./g, '─')}────${'─'.repeat(margin)}╮
├${'─'.repeat(margin)}    ${title}    ${'─'.repeat(margin)}┤
├${'─'.repeat(margin)}────${title.replace(/./g, '─')}────${'─'.repeat(margin)}┤`)
  f()
  console.groupEnd()
  console.log(`╰${'─'.repeat(margin)}────${title.replace(/./g, '─')}────${'─'.repeat(margin)}╯\n`)
}
