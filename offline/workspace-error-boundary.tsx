import { Component, type ReactNode } from "react";

export class WorkspaceErrorBoundary extends Component<{ children: ReactNode; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="offline-welcome" role="alert">
      <h1>Affichage interrompu</h1>
      <p>Le classeur est toujours ouvert. Utilise « Enregistrer sous » pour conserver une copie de tes données avant de réessayer.</p>
      <button type="button" onClick={this.props.onRetry}>Réessayer l’affichage</button>
    </section>;
  }
}
