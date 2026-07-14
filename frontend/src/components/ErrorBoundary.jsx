import { Component } from 'react';

// Catches render-time errors anywhere below it so a bug in one screen can't
// white-screen the whole app. Kept calm and actionable, matching the app's
// tone — never a scary stack trace for a non-technical user.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Local-only logging (no telemetry, no external calls) — visible in the
    // browser console if you're debugging, harmless otherwise.
    console.error('WellNest hit an unexpected error:', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.assign(import.meta.env.BASE_URL || '/');
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand-50 px-6 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-soft dark:bg-slate-900">
          <div className="mb-3 text-4xl" aria-hidden>🌿</div>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Something went sideways
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Not your fault — a small hiccup in the app. Your data is safe; it's saved as
            you go, not lost when a screen has trouble.
          </p>
          <button
            onClick={this.handleReload}
            className="btn-primary mt-5 w-full justify-center"
          >
            Back to Today
          </button>
          <p className="mt-3 text-xs text-slate-400">
            If this keeps happening, try Settings → Backup &amp; export → Save a backup,
            then let whoever set this up know.
          </p>
        </div>
      </div>
    );
  }
}
