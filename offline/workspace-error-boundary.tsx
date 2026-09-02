import { Component, type ReactNode } from "react";

export class WorkspaceErrorBoundary extends Component<{ children: ReactNode; onRetry: () => void; onFiles: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="surface local-file-failure" role="alert">
      <h1>Affichage interrompu</h1>
      <p>Le classeur est toujours ouvert. Utilise « Enregistrer sous » pour conserver une copie de tes données avant de réessayer.</p>
      <div><button type="button" className="secondary-button" onClick={this.props.onFiles}>Enregistrer mes données</button><button type="button" className="primary-button" onClick={this.props.onRetry}>Réessayer l’affichage</button></div>
    </section>;
  }
}
