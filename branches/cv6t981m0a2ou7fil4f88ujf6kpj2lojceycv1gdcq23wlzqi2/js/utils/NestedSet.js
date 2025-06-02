/**
 * @typedef {Object} NestedSetAsObject
 * @property {Array} set
 * @property {Array.<[any,NestedSetAsObject]>} map
 */

export class NestedSet {
  /** @property {Map.<any,NestedSet>} */
  #map
  /** @property {Set} */
  #set
  /**
   * @param {NestedSetAsObject} nestedSetAsObject
   */
  constructor (nestedSetAsObject) {
    if (nestedSetAsObject) {
      this.#set = new Set(nestedSetAsObject.set)
      this.#map = new Map(nestedSetAsObject.map.map(([key, value]) => [key, new NestedSet(value)]))
    } else {
      this.#map = new Map()
      this.#set = new Set()
    }
  }

  get size () {
    return this.values().length
  }

  add (root, ...rest) {
    if (rest.length) return this.#map.set(root, this.#map.get(root) ?? new NestedSet()).get(root).add(...rest)
    return this.#set.add(root)
  }

  get (root, ...rest) {
    if (rest.length) return this.#map.get(root)?.get(...rest)
    return this.#map.get(root)
  }

  delete (root, ...rest) {
    if (rest.length) {
      this.#map.get(root)?.delete?.(...rest)
    } else {
      this.#set.delete(root)
      this.#map.forEach(nestedSet => nestedSet.delete(root))
    }
    if (!this.#map.get(root)?.size) this.#map.delete(root)
  }

  deleteBranch (root, ...rest) {
    if (rest.length) return this.#map.get(root)?.deleteBranch(...rest)
    return this.#map.delete(root)
  }

  values (...path) {
    if (path.length) return this.#map.get(path[0])?.values?.(...path.slice(1)) ?? []
    return [...new Set([...this.#set, ...[...this.#map.keys()].map(key => this.values(key)).flat()])]
  }

  /**
   * return {NestedSetAsObject}
   */
  get asObject () {
    return {
      set: [...this.#set],
      map: [...this.#map].map(([key, value]) => [key, value.asObject])
    }
  }
}
