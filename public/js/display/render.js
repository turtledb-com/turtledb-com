function _constructValue (parts, node) {
  if (parts == null) return null
  if (typeof parts === 'function') {
    parts = parts(node)
  }
  if (Array.isArray(parts)) {
    const mappedParts = parts.map(part => {
      if (typeof part === 'function') {
        part = part(node)
      }
      if (part == null) return ''
      if (part && part.type === 'part') {
        return part.value
      } else {
        return part
      }
    })
    if (mappedParts.length === 1) {
      return mappedParts[0]
    }
    return mappedParts.join('')
  }
  return parts
}

function _renderAttributes (attributes, node) {
  let obj = {}
  attributes.forEach(attribute => {
    if (typeof attribute === 'function') {
      attribute = attribute(node)
    }
    if (attribute == null) return
    if (attribute && attribute.type === 'attribute') {
      const name = attribute.name
      if (name in obj) return
      const value = _constructValue(attribute.value, node)
      if (value == null) {
        obj[name] = name
      } else {
        obj[name] = value
      }
    } else if (Array.isArray(attribute)) {
      obj = Object.assign(_renderAttributes(attribute, node), obj)
    } else if (typeof attribute === 'object') {
      Object.entries(attribute).forEach(([name, value]) => {
        if (name in obj) return
        obj[name] = value
      })
    } else {
      const name = attribute.toString()
      if (name in obj) return
      obj[name] = name
    }
  })
  return obj
}

function _setAttribute (element, name, value) {
  if (element[name] !== value) {
    try {
      element[name] = value
    } catch (e) {
      // SVGs don't like getting their properties set and that's okay...
    }
  }
  if (!(typeof value).match(/(?:boolean|number|string)/)) {
    value = name
  }
  const str = value.toString()
  if (element.getAttribute(name) !== str) {
    element.setAttribute(name, str)
  }
  return element
}

function _setAttributes (element, attributes) {
  Object.entries(attributes).forEach(([name, value]) => {
    _setAttribute(element, name, value)
  })
  return element
}

function _pruneAttributes (element, newAttributes, oldAttributes) {
  const orphans = new Set(Object.keys(oldAttributes))
  Object.keys(newAttributes).forEach(attribute => orphans.delete(attribute))
  orphans.forEach(attribute => {
    element.removeAttribute(attribute)
    delete element[attribute]
  })
}

const _descriptionMap = new Map()
function _descriptionsToNodes (descriptions, xmlns, recaller, debugString) {
  if (!Array.isArray(descriptions)) {
    descriptions = [descriptions]
  }
  const nodes = []
  descriptions.forEach(description => {
    if (typeof description === 'function') {
      description = description()
    }
    if (description != null) {
      if (Array.isArray(description)) {
        nodes.push(..._descriptionsToNodes(description, xmlns, recaller, debugString))
      } else {
        if (description.tag === null || description.tag === '') {
          nodes.push(..._descriptionsToNodes(description.children, xmlns, recaller, debugString))
        } else if (typeof description.tag === 'function') {
          const attributes = _renderAttributes(description.attributes)
          nodes.push(..._descriptionsToNodes(description.tag(attributes, description.children, description), attributes.xmlns || xmlns, recaller, debugString))
        } else if (description.type) {
          if (!_descriptionMap.has(description)) {
            let node
            if (description.type === 'textnode') {
              node = document.createTextNode(description.value)
            } else {
              let oldAttributes = {}
              let newAttributes = _renderAttributes(description.attributes, node)
              node = document.createElementNS(newAttributes.xmlns || xmlns, description.tag, { is: newAttributes.is })
              _setAttributes(node, newAttributes)
              render(node, description.children, recaller, debugString, newAttributes.xmlns || xmlns)
              recaller.watch(debugString, () => {
                newAttributes = _renderAttributes(description.attributes, node)
                _setAttributes(node, newAttributes)
                _pruneAttributes(node, newAttributes, oldAttributes)
                oldAttributes = newAttributes
              })
            }
            _descriptionMap.set(description, node)
          }
          nodes.push(_descriptionMap.get(description))
        } else {
          nodes.push(document.createTextNode(description.toString()))
        }
      }
    }
  })
  return nodes
}

function _setChildren (element, descriptions, xmlns, recaller, debugString) {
  const newNodes = _descriptionsToNodes(descriptions, xmlns, recaller, debugString)
  newNodes.forEach((newNode, index) => {
    while (element.childNodes[index] !== newNode) {
      const oldNode = element.childNodes[index]
      if (!oldNode) {
        element.appendChild(newNode)
      } else if (newNodes.indexOf(oldNode) > index) {
        element.insertBefore(newNode, oldNode)
      } else {
        element.removeChild(oldNode)
      }
    }
  })
  while (element.childNodes.length > newNodes.length) {
    element.removeChild(element.lastChild)
  }
  return element
}

/**
 * @param {HTMLElement} element
 * @param {array|object|function|null} descriptions
 * @param {import('../utils/Recaller.js').Recaller} recaller
 * @param {string} debugString
 * @param {string} [xmlns='http://www.w3.org/1999/xhtml']
 */
export function render (element, descriptions, recaller, debugString, xmlns = 'http://www.w3.org/1999/xhtml') {
  if (!descriptions) {
    return _descriptionsToNodes(element, xmlns, recaller, debugString)
  }
  function f () {
    return _setChildren(element, descriptions, xmlns, recaller, debugString)
  }
  recaller.watch(debugString, f)
  return f
}
