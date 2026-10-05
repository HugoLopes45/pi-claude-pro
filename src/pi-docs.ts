const DOCS_SECTION = /<docs>\nPi documentation[\s\S]*?\n<\/docs>/;

/** Returns the Pi documentation section of a system prompt, without its tags. */
export function piDocsSection(systemPrompt: string): string | undefined {
  const match = DOCS_SECTION.exec(systemPrompt)?.[0];
  return match?.slice("<docs>\n".length, -"\n</docs>".length);
}

export function removePiDocs(text: string): string {
  const match = DOCS_SECTION.exec(text);
  if (!match) return text;
  const before = text.slice(0, match.index).trimEnd();
  const after = text.slice(match.index + match[0].length).trimStart();
  return [before, after].filter(Boolean).join("\n\n");
}

/** True when a prompt is likely about Pi itself, so the model needs Pi's docs. */
export function mentionsPi(prompt: string): boolean {
  return /\bpi\b/i.test(prompt);
}
