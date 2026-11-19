/**
 * Instant feedback while a dynamic staff / admin page renders on the server.
 * Without a loading boundary Next has nothing to show (or prefetch) for a
 * dynamic route, so a tap looked dead until the whole response arrived.
 * Styles: .route-loading in globals.css. Bilingual, since staff read either.
 */
export default function RouteLoading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading-spinner" aria-hidden="true" />
      <span className="route-loading-label">
        جارِ التحميل · <span dir="ltr">Loading</span>
      </span>
    </div>
  );
}
