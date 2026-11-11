package com.tahamobiles.staff;

import com.google.zxing.BarcodeFormat;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;

final class ScannerPolicy {
    enum Mode {
        AUTO("auto"), QR("qr"), BARCODE("barcode");
        final String value;
        Mode(String value) { this.value = value; }
        Collection<BarcodeFormat> formats() {
            if(this==QR)return Collections.singletonList(BarcodeFormat.QR_CODE);if(this==BARCODE)return BARCODE_FORMATS;java.util.ArrayList<BarcodeFormat> all=new java.util.ArrayList<>(BARCODE_FORMATS);all.add(BarcodeFormat.QR_CODE);return all;
        }
        boolean accepts(BarcodeFormat format) { return formats().contains(format); }
        static Mode fromValue(String value) { return "barcode".equals(value) ? BARCODE : "qr".equals(value)?QR:AUTO; }
    }
    private static final Collection<BarcodeFormat> BARCODE_FORMATS = Collections.unmodifiableList(Arrays.asList(
        BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.EAN_8, BarcodeFormat.EAN_13,
        BarcodeFormat.CODE_39, BarcodeFormat.CODE_93, BarcodeFormat.CODE_128, BarcodeFormat.ITF,
        BarcodeFormat.CODABAR, BarcodeFormat.RSS_14, BarcodeFormat.RSS_EXPANDED
    ));
    static final class Frame {
        final int left, top, width, height;
        Frame(int left, int top, int width, int height) {
            this.left = left; this.top = top; this.width = width; this.height = height;
        }
    }
    /** Portrait QR is 75% of screen width; constrain short windows to keep a square. */
    static Frame frame(int width, int height, Mode mode) {
        if (width <= 0 || height <= 0) throw new IllegalArgumentException("Positive viewport required");
        int frameWidth, frameHeight;
        if (mode == Mode.BARCODE) {
            frameWidth = Math.max(1, Math.round(width * 0.82f));
            frameHeight = Math.max(1, Math.round(Math.min(frameWidth * 0.30f, height * 0.32f)));
        } else {
            frameWidth = Math.max(1, Math.round(Math.min(width * 0.75f, height * 0.62f)));
            frameHeight = frameWidth;
        }
        return new Frame((width - frameWidth) / 2, (height - frameHeight) / 2, frameWidth, frameHeight);
    }

    static Frame frame(int width, int height, Mode mode, int reservedTop, int reservedBottom) {
        if (width <= 0 || height <= 0) throw new IllegalArgumentException("Positive viewport required");
        int top = Math.max(0, Math.min(reservedTop, height - 1));
        int bottom = Math.max(0, Math.min(reservedBottom, height - top - 1));
        int availableHeight = height - top - bottom;
        int frameWidth, frameHeight;
        if (mode == Mode.BARCODE) {
            frameWidth = Math.max(1, Math.round(width * 0.82f));
            frameHeight = Math.max(1, Math.round(Math.min(frameWidth * 0.30f, availableHeight * 0.60f)));
        } else {
            frameWidth = Math.max(1, Math.round(Math.min(width * 0.75f, availableHeight * 0.90f)));
            frameHeight = frameWidth;
        }
        return new Frame((width - frameWidth) / 2, top + (availableHeight - frameHeight) / 2, frameWidth, frameHeight);
    }
}
