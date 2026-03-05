import readline from 'readline'

/**
 * Prompts the user with a question and returns their answer
 * @param {string} query - The question to ask the user
 * @returns {Promise<string>} - The user's answer
 */
export async function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise(resolve => {
    rl.question(query, ans => {
      rl.close()
      resolve(ans)
    })
  })
}
