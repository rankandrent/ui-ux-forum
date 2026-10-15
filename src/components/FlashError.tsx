/** Shows the `?error=` message that moderator/delete actions redirect back with. */
export function FlashError({ value }: { value: unknown }) {
  if (typeof value !== "string" || !value) return null;
  return (
    <p className="alert alert-error" role="alert">
      {value.slice(0, 200)}
    </p>
  );
}
