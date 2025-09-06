import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props){ super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error){ return { hasError: true, error }; }
  componentDidCatch(error, info){ console.error('ErrorBoundary:', error, info); }
  render(){
    if (this.state.hasError) {
      return (
        <pre style={{ padding:16, whiteSpace:'pre-wrap', color:'#b91c1c', background:'#fff1f2', border:'1px solid #fecdd3' }}>
{String(this.state.error)}
        </pre>
      );
    }
    return this.props.children;
  }
}
