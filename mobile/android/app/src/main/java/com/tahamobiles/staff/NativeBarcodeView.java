package com.tahamobiles.staff;

import android.content.Context;
import android.graphics.Rect;
import android.util.AttributeSet;
import android.view.View;
import com.journeyapps.barcodescanner.BarcodeView;
import com.journeyapps.barcodescanner.camera.CenterCropStrategy;

/** The framing rectangle is used by ZXing to crop incoming camera frames before decoding. */
public final class NativeBarcodeView extends BarcodeView {
    private ScannerPolicy.Mode mode = ScannerPolicy.Mode.QR;

    public NativeBarcodeView(Context context, AttributeSet attributes) {
        super(context, attributes);
        setUseTextureView(true);
        setPreviewScalingStrategy(new CenterCropStrategy());
    }

    void setMode(ScannerPolicy.Mode mode) { this.mode = mode; }

    @Override protected Rect calculateFramingRect(Rect container, Rect surface) {
        ScannerPolicy.Frame frame = ScannerPolicy.frame(container.width(), container.height(), mode);
        if (getParent() instanceof View) {
            View parent = (View) getParent();
            View header = parent.findViewById(R.id.scanner_header), footer = parent.findViewById(R.id.scanner_footer);
            if (header != null && footer != null && header.getHeight() > 0 && footer.getHeight() > 0) {
                int gap = Math.round(16 * getResources().getDisplayMetrics().density);
                frame = ScannerPolicy.frame(container.width(), container.height(), mode,
                    header.getBottom() - getTop() + gap, getBottom() - footer.getTop() + gap);
            }
        }
        Rect result = new Rect(frame.left, frame.top, frame.left + frame.width, frame.top + frame.height);
        if (!result.intersect(surface)) return super.calculateFramingRect(container, surface);
        return result;
    }
}
