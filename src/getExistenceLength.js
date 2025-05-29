export async function getExistenceLength (getExists) {
  let lengthGuess = 0
  if (await getExists(0)) {
    let p = 0
    while (await getExists(2 ** p)) ++p
    if (p < 2) {
      lengthGuess = 2 ** p
    } else {
      lengthGuess = 2 ** (p - 1)
      let direction = 1
      for (let q = p - 2; q >= 0; --q) {
        lengthGuess += direction * 2 ** q
        direction = await getExists(lengthGuess) ? 1 : -1
      }
      if (direction === 1) ++lengthGuess
    }
  }
  return lengthGuess
}
