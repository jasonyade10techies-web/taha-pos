import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProductMediaManager } from "../../components/media/product-media-manager";
import { apiGallery, saveGallery } from "../../lib/api/gallery";
import { Button } from "../../components/ui/button";
import { mobileProductService } from "../../lib/mobile/product-service";
import { requireMobileOnline } from "../../lib/mobile/staff-service";
import { useAction } from "../../hooks/use-repository";
import { loadImageEdits } from "../../lib/image-edits";
import type { PosProductRow } from "../../types/database";
import type { MediaImage } from "../../types/demo";
export function MobileProductGallery({ product }: { product: PosProductRow }) {
  const [preparing, setPreparing] = useState(false);
  const [images, setImages] = useState<MediaImage[] | null>(null),
    action = useAction();
  const query = useQuery({
      queryKey: ["staff-product-gallery", product.id],
      queryFn: async () => {
        const rows = await apiGallery("product", product.id);
        const images = rows.map((r) => ({ ...r, url: "taha-media:" + r.path }));
        loadImageEdits(images);
        return images;
      },
    }),
    values = images || query.data || [];
  return (
    <div>
      <ProductMediaManager
        images={values}
        onChange={setImages}
        useDeviceCamera
        onBusyChange={setPreparing}
      />
      <Button
        variant="primary"
        disabled={!images || action.busy || preparing}
        onClick={() =>
          void action.run(async () => {
            requireMobileOnline();
            const row = await mobileProductService.get(product.id),
              gallery = await saveGallery(values, "product", product.id, true);
            await mobileProductService.save(
              row,
              gallery.map((image) => image.path!),
            );
            setImages(null);
          }, "Product images saved")
        }
      >
        Save Images
      </Button>
      {action.error && (
        <p role="alert" className="text-danger">
          {action.error}
        </p>
      )}
    </div>
  );
}
