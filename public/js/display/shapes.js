import { h } from './h.js'

export const cog = (attributes = {}, children = []) => {
  attributes.viewBox ??= '-1 -1 2 2'
  attributes.width ??= attributes.height ?? '1em'
  attributes.height ??= attributes.width ?? '1em'
  attributes.xmlns = 'http://www.w3.org/2000/svg'
  const teeth = +attributes.teeth || 6
  const holeR = +attributes.holeR || 0.25
  const innerR = +attributes.innerR || 0.60
  const outerR = +attributes.outerR || 0.90
  const outerWeight = +attributes.outerWeight || 6
  const innerWeight = +attributes.innerWeight || outerWeight * outerR / innerR
  const transWeight = +attributes.transWeight || 3
  const totalWeight = outerWeight + innerWeight + transWeight * 2
  const toXY = (outerness, aroundness) => {
    const r = outerR * outerness + innerR * (1 - outerness)
    const theta = (aroundness - 0.25 - outerWeight / totalWeight / (2 * teeth)) * 2 * Math.PI
    return `${Math.cos(theta) * r} ${Math.sin(theta) * r}`
  }
  return h`<svg ${attributes}>
    <path d="
      M ${toXY(1, 0)}
      ${[...Array(teeth).keys().map(tooth =>
        `
          A ${outerR} ${outerR} 0 0 1 ${toXY(1, (tooth + outerWeight / totalWeight) / teeth)}
          L ${toXY(0, (tooth + (outerWeight + transWeight) / totalWeight) / teeth)}
          A ${innerR} ${innerR} 0 0 1 ${toXY(0, (tooth + (outerWeight + transWeight + innerWeight) / totalWeight) / teeth)}
          L ${toXY(1, (tooth + 1) / teeth)}
        `
      )].join('')}
      Z
      M 0 -${holeR}
      A ${holeR} ${holeR} 0 1 0 0 ${holeR}
      A ${holeR} ${holeR} 0 1 0 0 -${holeR}
      Z
    "/>
    ${children}
  </svg>`
}

export const star = (attributes = {}, children = []) => {
  attributes.viewBox ??= '-1 -1 2 2'
  attributes.width ??= attributes.height ?? '1em'
  attributes.height ??= attributes.width ?? '1em'
  attributes.xmlns = 'http://www.w3.org/2000/svg'
  const points = +attributes.points || 5
  const innerR = +attributes.innerR || 0.60
  const outerR = +attributes.outerR || 0.90
  const toXY = (outerness, aroundness) => {
    const r = outerR * outerness + innerR * (1 - outerness)
    const theta = (aroundness - 0.25) * 2 * Math.PI
    return `${Math.cos(theta) * r} ${Math.sin(theta) * r}`
  }
  return h`<svg ${attributes}>
    <path d="
      M ${toXY(1, 0)}
      ${[...Array(points).keys().map(point =>
        `
          L ${toXY(0, (point + 0.5) / points)}
          L ${toXY(1, (point + 1) / points)}
        `
      )].join('')}
      Z
    "/>
    ${children}
  </svg>`
}

export const equilateral = (attributes = {}, children = []) => {
  attributes.viewBox ??= '-1 -1 2 2'
  attributes.width ??= attributes.height ?? '1em'
  attributes.height ??= attributes.width ?? '1em'
  attributes.xmlns = 'http://www.w3.org/2000/svg'
  const corners = +attributes.corners || 3
  const r = +attributes.r || 0.90
  const toXY = (aroundness) => {
    const theta = (aroundness - 0.25) * 2 * Math.PI
    return `${Math.cos(theta) * r} ${Math.sin(theta) * r}`
  }
  return h`<svg ${attributes}>
    <path d="
      M ${toXY(0)}
      ${[...Array(corners).keys().map(corner =>
        `L ${toXY((corner + 1) / corners)}`
      )].join('')}
      Z
    "/>
    ${children}
  </svg>`
}
