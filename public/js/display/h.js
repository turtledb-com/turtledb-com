const _voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
const END = Symbol('end')

function _assertChar (arr, regex) {
  if (!arr[arr.i].match(regex)) {
    throw new Error(`expected ${regex}. got ${arr[arr.i]} at i=${arr.i}`)
  }
  arr.i++
}

function _readValue (arr) {
  if (arr[arr.i].isValue) {
    return arr[arr.i++]
  }
}

function _readEscaped (arr) {
  _assertChar(arr, /&/)
  if (_readIf(arr, 'amp;')) {
    return '&'
  } else if (_readIf(arr, 'apos;')) {
    return '\''
  } else if (_readIf(arr, 'gt;')) {
    return '>'
  } else if (_readIf(arr, 'lt;')) {
    return '<'
  } else if (_readIf(arr, 'quot;')) {
    return '"'
  } else if (_readIf(arr, 'nbsp;')) {
    return ' '
  } else {
    throw new Error('unhandled escape sequence')
  }
}

function _readTo (arr, regex) {
  const ss = []
  while (arr.i < arr.length) {
    const c = arr[arr.i]
    if (c.isValue || c.match(regex)) {
      return ss.join('')
    } else if (c === '&') {
      ss.push(_readEscaped(arr))
    } else {
      ss.push(c)
      arr.i++
    }
  }
  return ss.join('')
}

function _skipWhiteSpace (arr) {
  _readTo(arr, /\S/)
}

function _readIf (arr, str) {
  if (!str.length) {
    str = [str]
  }
  const out = []
  for (let i = 0; i < str.length; i++) {
    const char = arr[arr.i + i]
    if (!char || !char.match || !char.match(str[i])) {
      return false
    }
    out.push(char)
  }
  arr.i += str.length
  return out.join('')
}

function _readValueParts (arr, regex) {
  const out = []
  let ss = []
  while (arr.i < arr.length) {
    const c = arr[arr.i]
    if (c.isValue) {
      if (ss.length) {
        out.push({ type: 'part', value: ss.join('') })
        ss = []
      }
      out.push(c.value)
      arr.i++
    } else if (c.match(regex)) {
      if (ss.length) {
        out.push({ type: 'part', value: ss.join('') })
      }
      return out
    } else if (c === '&') {
      ss.push(_readEscaped(arr))
    } else {
      ss.push(c)
      arr.i++
    }
  }
}

function _decodeAttribute (arr) {
  _skipWhiteSpace(arr)
  const c = arr[arr.i]
  if (c === '/' || c === '>') {
    return END
  }
  let name = _readValue(arr)
  if (name && name.isValue) {
    return name.value
  }
  name = _readTo(arr, /[\s=/>]/)
  if (!name) {
    throw new Error('attribute must have a name (dynamic attributes okay, dynamic names... sorry)')
  }
  _skipWhiteSpace(arr)
  const equalSign = _readIf(arr, '=')
  if (equalSign) {
    _skipWhiteSpace(arr)
    let value = _readValue(arr)
    if (value) {
      value = value.value
    } else {
      const quote = _readIf(arr, /['"]/)
      if (quote) {
        value = _readValueParts(arr, quote)
        _assertChar(arr, quote)
      } else {
        value = _readTo(arr, /[\s=/>]/)
      }
    }
    return { type: 'attribute', name, value }
  } else {
    return { type: 'attribute', name }
  }
}

function _decodeAttributes (arr) {
  const attributes = []
  while (true) {
    const attribute = _decodeAttribute(arr)
    if (attribute !== END) {
      attributes.push(attribute)
    } else {
      return attributes
    }
  }
}

function _decodeTag (arr) {
  _skipWhiteSpace(arr)
  const c = arr[arr.i]
  if (c.isValue) {
    arr.i++
    return c.value
  }
  return _readTo(arr, /[\s/>]/)
}

function _decodeElement (arr) {
  const c = arr[arr.i]
  if (c.isValue) {
    arr.i++
    return c.value
  } else if (c === '<') {
    _assertChar(arr, /</)
    const isClosing = _readIf(arr, '/')
    const tag = _decodeTag(arr)
    const isVoid = _voidElements.has(tag)
    const attributes = _decodeAttributes(arr)
    const isEmpty = _readIf(arr, '/') || isVoid
    _assertChar(arr, />/)
    const children = (isClosing || isEmpty) ? [] : _decodeElements(arr, tag)
    if (isVoid && isClosing) return null
    return { type: 'node', tag, attributes, children, isClosing }
  } else {
    return { type: 'textnode', value: _readTo(arr, /</) }
  }
}

function _decodeElements (arr, closingTag) {
  const nodes = []
  while (arr.i < arr.length) {
    const node = _decodeElement(arr)
    if (node != null) {
      if (node.isClosing) {
        if (closingTag != null) {
          return nodes
        }
      } else {
        delete node.isClosing
        nodes.push(node)
      }
    }
  }
  return [].concat.apply([], nodes)
}

export function h (strings, ...values) {
  const ss = [strings[0].split('')]
  for (let i = 0; i < values.length; i++) {
    ss.push({ value: values[i], isValue: true })
    ss.push(strings[i + 1].split(''))
  }
  const arr = [].concat.apply([], ss)
  arr.i = 0
  return _decodeElements(arr, null)
}
