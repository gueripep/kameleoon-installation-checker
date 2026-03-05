/**
 * Builds a URL object from a string
 * @param {string} string - The URL string to parse
 * @returns {URL|undefined} - URL object or undefined if invalid
 */
export default function urlBuilder(string = '') {
  try {
    return new URL(string)
  } catch (error) {
    if (error.constructor.name === 'TypeError') {
      console.error('Malformed URL', string)
    } else {
      console.error(error)
    }
  }  
}
