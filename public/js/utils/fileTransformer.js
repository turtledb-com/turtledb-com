export const textFileExtensions = ['js', 'html', 'css', 'txt', 'gitignore']
export const jsonFileExtensions = ['json']

export const TEXT_FILE = 'text file'
export const JSON_FILE = 'json file'
export const BINARY_FILE = 'binary file'

export const pathToType = path => {
  const extension = path.split('.').pop()
  if (textFileExtensions.includes(extension)) return TEXT_FILE
  if (jsonFileExtensions.includes(extension)) return JSON_FILE
  return BINARY_FILE
}

export const stringToLines = string => string.split('\n')
export const linesToString = lines => (typeof lines === 'string' && lines) || (Array.isArray(lines) && lines.join('\n')) || ''
