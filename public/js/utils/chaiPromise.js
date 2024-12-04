if (typeof window !== 'undefined' && typeof chai === 'undefined') {
  throw new Error('chai not found, please embed chai (like: <script src="...chai.js"/>)')
}

// eslint-disable-next-line no-undef
const _chai = (typeof chai === 'undefined') ? await import('chai') : chai

/** @type {import('chai')} */
export default _chai
