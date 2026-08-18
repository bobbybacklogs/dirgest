import readline from 'node:readline';
import { parseSelection } from '@dirgest/sdk';

export { parseSelection };

export async function promptForSelection(input, output, { interactive, count = 6 } = {}) {
  if (!interactive) {
    output.write('Run in an interactive terminal to choose 1-6, a (all prompts), or q (exit).\n');
    return 'quit';
  }
  const interfaceInstance = readline.createInterface({ input, output });
  const answer = await new Promise((resolve) => interfaceInstance.question('Choose a suggestion: ', resolve));
  interfaceInstance.close();
  const choice = parseSelection(answer, count);
  if (choice === null) output.write(`No selection made. Use 1-${count}, a, or q.\n`);
  return choice ?? 'quit';
}