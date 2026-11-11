import { Component, type ErrorInfo, type ReactNode } from "react";
import {bundledMobile} from "../lib/mobile/runtime";

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  private recover=()=>{if(location.hash.startsWith("#/diagnostics")||location.hash.startsWith("#/shop-connection"))this.setState({failed:false});};
  componentDidMount(){window.addEventListener("hashchange",this.recover);}
  componentWillUnmount(){window.removeEventListener("hashchange",this.recover);}
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    void error;void info;window.__tahaLastUiError="App rendering failed. Reload App or reset the shop connection.";console.error("Workspace rendering failed. Open Diagnostics; credentials are not logged.");
  }
  render() {
    if (this.state.failed)
      return (
        <main className="fatal-error">
          <h1>Something went wrong</h1>
          <p>Please reload the app. Your account and shop data stay on the server.</p>
          <button
            className="button button-primary"
            onClick={() => window.location.reload()}
          >
            Reload App
          </button>
          {bundledMobile&&<><button className="button" onClick={()=>location.hash="/diagnostics"}>Diagnostics</button><button className="button" onClick={()=>{localStorage.removeItem("taha-shop-connection");location.hash="/shop-connection";location.reload();}}>Reset Shop Connection</button></>}
        </main>
      );
    return this.props.children;
  }
}
