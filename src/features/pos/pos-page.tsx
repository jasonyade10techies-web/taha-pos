import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ScanBarcode, Keyboard } from "lucide-react";
import { queryKeys, retailDataSource } from "../../lib/data-source";
import { PageHeading } from "../../components/ui/page-heading";
import { ProductSearch } from "../../components/pos/product-search";
import { CartPanel } from "../../components/pos/cart-panel";
import { CheckoutDialog } from "../../components/pos/checkout-dialog";
import { useUiStore } from "../../stores/ui-store";
import { useSessionStore } from "../../stores/session-store";
import { useCartStore } from "../../stores/cart-store";
import { useRepository } from "../../hooks/use-repository";
import { repositories } from "../../lib/repositories";
import { publishCustomerDisplay } from "../../hooks/use-customer-display";
import { useKeyboardStore } from "../../stores/keyboard-store";
import { Button } from "../../components/ui/button";
import { CustomerDisplayControl } from "../../components/pos/customer-display-control";

export function PosPage() {
  const context = useSessionStore((s) => s.context);
  const setKeyboard = useKeyboardStore((s) => s.setOpen);
  const policy = useRepository(
    "pos-stock-policy",
    () => repositories.settings.get(),
  );
  const displayMethods = useRepository("display-enabled-methods", () => repositories.payments.list());
  useEffect(() => {
    if (!policy.data) return;
    const ui = useUiStore.getState();
    ui.setKeyboardEnabled(policy.data.keyboardEnabled !== false);
    ui.setKeyboardPreferences({keyboardOpenOnTouch:policy.data.keyboardOpenOnTouch === true,keyboardNumericAmounts:policy.data.keyboardNumericAmounts !== false,keyboardSize:policy.data.keyboardSize ?? "Compact"});
    ui.setCustomerDisplayEnabled(policy.data.customerDisplay);
    ui.setCustomerDisplayFullscreen(policy.data.customerDisplayFullscreen === true);
    publishCustomerDisplay({ config: { enabled: policy.data.customerDisplay, phone: policy.data.phone, address: policy.data.address, promotions: policy.data.customerDisplayPromotions !== false, paymentQr: policy.data.customerDisplayPaymentQr !== false, fullscreen: policy.data.customerDisplayFullscreen === true, completeDuration: policy.data.customerDisplayIdleTimeout ?? 12, methods: (displayMethods.data ?? []).filter((m) => m.enabled).map((m) => ({ name: m.name, kind: m.kind })) } });
  }, [policy.data, displayMethods.data]);
  const setStockPolicy = useCartStore((s) => s.setStockPolicy);
  useEffect(
    () => setStockPolicy(policy.data?.negativeStock === true),
    [policy.data?.negativeStock, setStockPolicy],
  );
  const { data, isError } = useQuery({
    queryKey: queryKeys.posProducts(
      context?.profile?.id ?? "",
      context?.store?.id ?? "",
    ),
    queryFn: retailDataSource.posProducts,
  });
  return (
    <div className="pos-page">
      <PageHeading
        title="New Sale"
        subtitle="Find it. Add it. Keep your customers moving."
        action={
          <div className="pos-heading-actions"><span className="pos-ready"><ScanBarcode size={16} /><span>Scanner ready</span><i /></span><CustomerDisplayControl /><Button size="small" variant="secondary" onClick={() => setKeyboard(true)}><Keyboard size={15} /> Keyboard</Button></div>
        }
      />
      <div className="pos-workbench">
        {data ? (
          <ProductSearch products={data} />
        ) : (
          <div className="panel p-8" role="status">
            {isError ? "Unable to load products." : "Loading products…"}
          </div>
        )}
        <CartPanel />
      </div>
      <CheckoutDialog />
    </div>
  );
}
