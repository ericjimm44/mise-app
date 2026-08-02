/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Anthropic API key, read client-side.
   *
   * Local-first with no backend, so generation calls the API from the browser.
   * A deliberate, recorded trade-off for a personal tool (docs/decisions.md §3)
   * and disqualifying for a public product — at that point generation moves
   * behind a server.
   *
   * Optional on purpose: the kitchen, the cookbook and the technique library
   * all work without it, and the UI says so plainly rather than failing on a
   * click.
   */
  readonly VITE_ANTHROPIC_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
