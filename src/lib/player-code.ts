// Short, human-typable game code for the player status link. 6 uppercase hex
// chars — deliberately hex so there are no O/I/L letters to confuse with 0/1.
// New games get one from a Postgres default (see migration 0005); this is used
// app-side when a coordinator regenerates their link + code.
export function makePlayerCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}
