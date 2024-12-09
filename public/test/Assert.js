export class Assert {
  /**
   *
   * @param {import ('./Runner.js').Runner} runner
   */
  constructor (runner) {
    this.runner = runner
  }

  async equal (expected, actual, message = `expected === actual : ${JSON.stringify(expected)} === ${JSON.stringify(actual)}`) {
    this.runner.appendChild(message, () => {
      const equal = expected === actual
      if (!equal) throw new Error(message)
    }, 'equal')
  }
}
