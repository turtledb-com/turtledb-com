import { fallbackCPK } from '../../js/constants.js'
import { h } from '../../js/display/h.js'
import { render } from '../../js/display/render.js'
import { componentAtPath, deriveDefaults } from '../../js/utils/components.js'

const { recaller, elementName } = deriveDefaults(import.meta.url)

window.customElements.define(elementName, class extends window.HTMLElement {
  constructor () {
    super()
    console.log('\n\n object')
    this.attachShadow({ mode: 'open' })
  }

  connectedCallback () {
    render(this.shadowRoot, this.content, recaller, elementName)
  }

  object = componentAtPath('components/turtle-explorer/object.js', fallbackCPK)

  content = () => {
    /** @type {{pointer: import('../../js/dataModel/Uint8ArrayLayerPointer.js').Uint8ArrayLayerPointer, address: number, exclude: Array.<String>}} */
    const { pointer, value } = this
    if (value && typeof value === 'object') {
      return h`
        <dl>
          ${() => Object.keys(value).map(fieldName => {
            return h`
              <dt>${fieldName}</dt>
              <dd><${this.object} ${{ pointer, value: pointer.getRefs(value[fieldName]), key: `${this.key}.${fieldName}` }}/></dd>
            `
          })}
        </dl>
      `
    }
    return 'unhandled type'
  }
})
