import { useLocation, Link } from "react-router-dom";
import { ArrowRight, Layers3 } from "lucide-react";
import { pageContext } from "../components/navigation/navigation-data";
import { PageHeading } from "../components/ui/page-heading";
import { Badge } from "../components/ui/badge";

export function PlaceholderPage() {
  const { pathname } = useLocation();
  const { item, group } = pageContext(pathname);
  const Icon = item?.icon ?? Layers3;
  return (
    <div className="placeholder-page">
      <PageHeading
        title={item?.label ?? "Page not found"}
        subtitle={
          item?.description ?? "This page is not part of your workspace."
        }
      />
      <section className="placeholder-card">
        <span className="placeholder-icon">
          <Icon size={34} strokeWidth={1.5} />
        </span>
        <Badge>{item ? "UP NEXT" : "404"}</Badge>
        <h2>
          {item
            ? "This module is coming next."
            : "Let’s get you back to your workspace."}
        </h2>
        <p>
          {item
            ? `${group} workflows will be added in a future phase. Your Dashboard and New Sale workspace are ready to explore.`
            : "Use the navigation to open an available page."}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link className="button button-primary" to="/pos">
            Open New Sale
            <ArrowRight size={17} />
          </Link>
          <Link className="button button-secondary" to="/dashboard">
            Back to Dashboard
          </Link>
        </div>
        <span className="placeholder-footnote">
          TAHA MOBILES · Building the right foundation, one phase at a time.
        </span>
      </section>
    </div>
  );
}
