package com.tahamobiles.staff;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Rect;
import android.graphics.RectF;
import android.util.AttributeSet;
import android.view.View;

/** Draw the visible frame directly from ZXing's actual camera crop. */
public final class ScannerViewfinder extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path corners = new Path();
    private final RectF outline = new RectF();
    private final float density;
    private NativeBarcodeView preview;

    public ScannerViewfinder(Context context, AttributeSet attributes) {
        super(context, attributes);
        density = getResources().getDisplayMetrics().density;
    }

    void bind(NativeBarcodeView preview) { this.preview = preview; invalidate(); }

    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        Rect frame = preview == null ? null : preview.getFramingRect();
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(0xb8101418);
        if (frame == null) { canvas.drawRect(0, 0, getWidth(), getHeight(), paint); return; }
        canvas.drawRect(0, 0, getWidth(), frame.top, paint);
        canvas.drawRect(0, frame.top, frame.left, frame.bottom, paint);
        canvas.drawRect(frame.right, frame.top, getWidth(), frame.bottom, paint);
        canvas.drawRect(0, frame.bottom, getWidth(), getHeight(), paint);

        outline.set(frame);
        float shortestSide = Math.min(frame.width(), frame.height());
        float radius = Math.min(16 * density, shortestSide * 0.12f);
        float length = Math.max(radius * 1.5f, shortestSide * 0.13f);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(density);
        paint.setColor(0x70e7c269);
        canvas.drawRoundRect(outline, radius, radius, paint);
        paint.setStrokeWidth(4 * density);
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setColor(Color.rgb(242, 188, 45));
        float left = frame.left, top = frame.top, right = frame.right, bottom = frame.bottom;
        corners.reset();
        corners.moveTo(left, top + length); corners.lineTo(left, top + radius);
        corners.quadTo(left, top, left + radius, top); corners.lineTo(left + length, top);
        corners.moveTo(right - length, top); corners.lineTo(right - radius, top);
        corners.quadTo(right, top, right, top + radius); corners.lineTo(right, top + length);
        corners.moveTo(right, bottom - length); corners.lineTo(right, bottom - radius);
        corners.quadTo(right, bottom, right - radius, bottom); corners.lineTo(right - length, bottom);
        corners.moveTo(left + length, bottom); corners.lineTo(left + radius, bottom);
        corners.quadTo(left, bottom, left, bottom - radius); corners.lineTo(left, bottom - length);
        canvas.drawPath(corners, paint);
    }
}
