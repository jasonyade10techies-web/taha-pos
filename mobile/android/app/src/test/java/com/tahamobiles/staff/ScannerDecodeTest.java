package com.tahamobiles.staff;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.RGBLuminanceSource;
import com.google.zxing.Result;
import com.google.zxing.common.BitMatrix;
import com.journeyapps.barcodescanner.Decoder;
import com.journeyapps.barcodescanner.DefaultDecoderFactory;
import java.util.Collections;
import org.junit.Test;
import static org.junit.Assert.*;

/** Exercise the same real ZXing decoder factory and format policy as the camera screen. */
public class ScannerDecodeTest {
    private RGBLuminanceSource image(String value, BarcodeFormat format, int width, int height) throws Exception {
        BitMatrix matrix = new MultiFormatWriter().encode(value, format, width, height);
        int[] pixels = new int[width * height];
        for (int y = 0; y < height; y++) for (int x = 0; x < width; x++) {
            pixels[y * width + x] = matrix.get(x, y) ? 0xff000000 : 0xffffffff;
        }
        return new RGBLuminanceSource(width, height, pixels);
    }

    private Decoder decoder(ScannerPolicy.Mode mode) {
        return new DefaultDecoderFactory(mode.formats()).createDecoder(Collections.emptyMap());
    }

    @Test public void autoModeRecognizesBothQrAndProductBarcode() throws Exception {
        assertEquals(BarcodeFormat.QR_CODE, decoder(ScannerPolicy.Mode.AUTO).decode(image("taha-mobile://product?code=TM-P-000001", BarcodeFormat.QR_CODE, 384, 384)).getBarcodeFormat());
        assertEquals(BarcodeFormat.CODE_128, decoder(ScannerPolicy.Mode.AUTO).decode(image("TM-P-000001", BarcodeFormat.CODE_128, 640, 240)).getBarcodeFormat());
        assertEquals(ScannerPolicy.frame(1080,1920,ScannerPolicy.Mode.QR).width, ScannerPolicy.frame(1080,1920,ScannerPolicy.Mode.AUTO).height);
    }

    @Test public void qrModeDecodesPairingQrAndBarcodeModeRejectsIt() throws Exception {
        String value = "taha-mobile://pair?terminal=counter-1&code=12345678";
        RGBLuminanceSource source = image(value, BarcodeFormat.QR_CODE, 384, 384);
        Result result = decoder(ScannerPolicy.Mode.QR).decode(source);
        assertNotNull(result);
        assertEquals(value, result.getText());
        assertEquals(BarcodeFormat.QR_CODE, result.getBarcodeFormat());
        assertNull(decoder(ScannerPolicy.Mode.BARCODE).decode(source));
    }

    @Test public void barcodeModeDecodesCode128AndQrModeRejectsIt() throws Exception {
        RGBLuminanceSource source = image("TAHA-123456", BarcodeFormat.CODE_128, 640, 240);
        Result result = decoder(ScannerPolicy.Mode.BARCODE).decode(source);
        assertNotNull(result);
        assertEquals("TAHA-123456", result.getText());
        assertEquals(BarcodeFormat.CODE_128, result.getBarcodeFormat());
        assertNull(decoder(ScannerPolicy.Mode.QR).decode(source));
    }
}
