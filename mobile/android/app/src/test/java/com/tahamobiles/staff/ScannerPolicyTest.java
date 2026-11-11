package com.tahamobiles.staff;

import com.google.zxing.BarcodeFormat;
import org.junit.Test;
import static org.junit.Assert.*;

public class ScannerPolicyTest {
    @Test public void qrFrameIsSquareAtThreeQuartersOfPortraitWidth() {
        ScannerPolicy.Frame frame = ScannerPolicy.frame(1080, 1920, ScannerPolicy.Mode.QR);
        assertEquals(810, frame.width);
        assertEquals(810, frame.height);
        assertEquals(135, frame.left);
        assertEquals(555, frame.top);
    }

    @Test public void barcodeFrameIsWideAndStaysInsideShortScreens() {
        ScannerPolicy.Frame frame = ScannerPolicy.frame(1080, 1920, ScannerPolicy.Mode.BARCODE);
        assertEquals(886, frame.width);
        assertEquals(266, frame.height);
        ScannerPolicy.Frame shortFrame = ScannerPolicy.frame(1920, 500, ScannerPolicy.Mode.QR);
        assertEquals(shortFrame.width, shortFrame.height);
        assertTrue(shortFrame.top > 0);
        assertTrue(shortFrame.top + shortFrame.height < 500);
    }

    @Test public void qrAndBarcodeModesCannotReturnEachOthersFormats() {
        assertTrue(ScannerPolicy.Mode.QR.accepts(BarcodeFormat.QR_CODE));
        assertFalse(ScannerPolicy.Mode.QR.accepts(BarcodeFormat.CODE_128));
        assertTrue(ScannerPolicy.Mode.BARCODE.accepts(BarcodeFormat.CODE_128));
        assertTrue(ScannerPolicy.Mode.BARCODE.accepts(BarcodeFormat.EAN_13));
        assertFalse(ScannerPolicy.Mode.BARCODE.accepts(BarcodeFormat.QR_CODE));
        assertFalse(ScannerPolicy.Mode.BARCODE.accepts(BarcodeFormat.DATA_MATRIX));
        assertEquals(ScannerPolicy.Mode.AUTO, ScannerPolicy.Mode.fromValue(null));
        assertEquals(ScannerPolicy.Mode.AUTO, ScannerPolicy.Mode.fromValue("unknown"));
        assertTrue(ScannerPolicy.Mode.AUTO.accepts(BarcodeFormat.QR_CODE));
        assertTrue(ScannerPolicy.Mode.AUTO.accepts(BarcodeFormat.EAN_13));
        assertFalse(ScannerPolicy.Mode.AUTO.accepts(BarcodeFormat.DATA_MATRIX));
    }

    @Test public void frameKeepsHeaderAndBottomControlsClear() {
        ScannerPolicy.Frame frame = ScannerPolicy.frame(1080, 1920, ScannerPolicy.Mode.QR, 500, 300);
        assertEquals(810, frame.width);
        assertEquals(810, frame.height);
        assertEquals(655, frame.top);
        assertTrue(frame.top >= 500);
        assertTrue(frame.top + frame.height <= 1620);
    }
}
