export const testMarkdownContent = {
  simple: '# Simple Document\n\nThis is a simple test document.',
  withCode: `# Document with Code

Here is some code:

\`\`\`javascript
function hello() {
  console.log('Hello, World!');
}
\`\`\`

And some inline \`code\` too.`,
  nested: `# Nested Document

## Section 1

Content for section 1.

### Subsection 1.1

Nested content.

## Section 2

More content.`,
  conflict: {
    repo: '# Repository Version\n\nThis content is from the repository.',
    wiki: '# Wiki Version\n\nThis content is from the wiki.',
    merged: '# Merged Version\n\nThis content has been merged.',
  },
}

export const testFileStructure = {
  flat: [
    { path: 'README.md', content: testMarkdownContent.simple },
    { path: 'guide.md', content: testMarkdownContent.withCode },
  ],
  nested: [
    { path: 'README.md', content: testMarkdownContent.simple },
    { path: 'docs/guide.md', content: testMarkdownContent.withCode },
    { path: 'docs/api/reference.md', content: testMarkdownContent.nested },
  ],
  withNonMarkdown: [
    { path: 'README.md', content: testMarkdownContent.simple },
    { path: 'config.json', content: '{"key": "value"}' },
    { path: '.gitignore', content: 'node_modules/' },
  ],
}