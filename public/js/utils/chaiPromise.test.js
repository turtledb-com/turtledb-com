if (typeof window !== 'undefined' && typeof chai === 'undefined') {
  throw new Error('chai not found, please embed chai (like: <script src="...chai.js"/>)')
}
// eslint-disable-next-line no-undef
export default typeof window === 'undefined' ? await import('chai') : chai
