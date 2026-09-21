import readline from 'node:readline';
import { parseSelection } from '@dirgest/sdk';

export { parseSelection };

export function selectionInstructions(count) {
  return `Choose 1-${count} for a full coding prompt, comma-separated numbers (for example 1, 5) for several, x1 or x 1,5 to exclude ideas from later runs, a for all prompts, q to exit.`;
}

export async function promptToSaveAskChoice(input, output, { interactive, fit } = {}) {
  const prompt = fit
    ? 'Save this idea so dirgest remembers it? [y/N] '
    : 'Save the recommended alternative so dirgest remembers it? [y/N] ';
  if (!interactive) {
    output.write('Run in an interactive terminal to save this choice to history.\n');
    return false;
  }
  const interfaceInstance = readline.createInterface({ input, output });
  const answer = await new Promise((resolve) => interfaceInstance.question(prompt, resolve));
  interfaceInstance.close();
  return /^y(?:es)?$/i.test(String(answer).trim());
}

export async function promptForSelection(input, output, { interactive, count = 6 } = {}) {
  if (!interactive) {
    output.write(`Run in an interactive terminal to choose 1-${count}, comma-separated numbers, x1 to exclude, a (all prompts), or q (exit).\n`);
    return 'quit';
  }
  const interfaceInstance = readline.createInterface({ input, output });
  const answer = await new Promise((resolve) => interfaceInstance.question('Choose a suggestion: ', resolve));
  interfaceInstance.close();
  const choice = parseSelection(answer, count);
  if (choice === null) output.write(`No selection made. Use 1-${count}, comma-separated numbers, x1 to exclude, a, or q.\n`);
  return choice ?? 'quit';
}
