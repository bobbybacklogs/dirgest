import readline from 'node:readline';

export function parseSelection(value, count) {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'q') return 'quit';
  if (normalized === 'a') return 'all';
  const selected = Number.parseInt(normalized, 10);
  return Number.isInteger(selected) && selected >= 1 && selected <= count ? selected - 1 : null;
}

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