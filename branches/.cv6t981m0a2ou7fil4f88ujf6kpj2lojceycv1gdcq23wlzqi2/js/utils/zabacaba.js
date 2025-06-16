/**
 *                                                                 |                                                               |
 *                                 |                               |                               |                               |
 *                 |               |               |               |               |               |               |               |
 *         |       |       |       |       |       |       |       |       |       |       |       |       |       |       |       |
 *     |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |
 *   | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | |
 *  ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
 * zabacabadabacabaeabacabadabacabafabacabadabacabaeabacabadabacabagabacabadabacabaeabacabadabacabafabacabadabacabaeabacabadabacaba
 * like the "ruler function" (abacaba) but with numbers for binary-tree-like jumping
 * @param {number} i
 * @returns {number}
 */

export function zabacaba (i) {
  if (i === 0) return 0
  if (i === 1) return 1
  const j = ~(i - 1)
  const b = Math.clz32(j & -j) // 31 - b is right zeros
  return 32 - b
}
