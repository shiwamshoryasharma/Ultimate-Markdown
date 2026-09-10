import { defaultSchema, type Schema } from 'hast-util-sanitize'

// Raw CSS is parsed and restricted by documentStylePlugin BEFORE this schema.
// Only generated, scoped styles are reinserted AFTER sanitization.
export const markdownSanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [...new Set([...(defaultSchema.tagNames ?? []), 'section', 'article', 'aside', 'input', 'video', 'audio', 'source', 'details', 'summary'])],
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'className', 'style'],
    code: [...(defaultSchema.attributes?.code ?? []), ['className', /^language-/]],
    span: [...(defaultSchema.attributes?.span ?? []), 'className'],
    div: [...(defaultSchema.attributes?.div ?? []), 'className'],
    input: [['type', 'checkbox'], 'checked', 'disabled'],
    video: ['src', 'controls', 'width', 'height', 'poster', 'muted', 'loop', 'className', 'style'],
    audio: ['src', 'controls', 'className', 'style'],
    source: ['src', 'type'],
    img: [...(defaultSchema.attributes?.img ?? []), 'width', 'height', 'loading', 'className', 'style'],
  },
  protocols: { ...defaultSchema.protocols, src: [...new Set([...(defaultSchema.protocols?.src ?? []), 'blob', 'data'])] },
}
