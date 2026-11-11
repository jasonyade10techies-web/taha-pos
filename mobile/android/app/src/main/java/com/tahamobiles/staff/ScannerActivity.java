package com.tahamobiles.staff;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.TextView;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.journeyapps.barcodescanner.BarcodeCallback;
import com.journeyapps.barcodescanner.BarcodeResult;
import com.journeyapps.barcodescanner.CameraPreview;
import com.journeyapps.barcodescanner.CaptureManager;
import com.journeyapps.barcodescanner.DefaultDecoderFactory;

/** QR-first native camera screen. One successful decode is returned through ScanContract. */
public final class ScannerActivity extends ComponentActivity {
    static final String EXTRA_MODE = "taha.scan.mode";
    static final String EXTRA_ERROR = "taha.scan.error";
    private NativeBarcodeView preview;
    private ScannerViewfinder viewfinder;
    private ScannerPolicy.Mode mode = ScannerPolicy.Mode.AUTO;
    private ImageButton flash;
    private boolean resumed, returned, torchOn;

    private final BarcodeCallback callback = new BarcodeCallback() {
        @Override public void barcodeResult(BarcodeResult result) {
            // A result queued just before a mode change must not escape the new format filter.
            if (returned || !mode.accepts(result.getBarcodeFormat())) return;
            returned = true;
            preview.stopDecoding();
            preview.setTorch(false);
            Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                vibrator.vibrate(VibrationEffect.createOneShot(80, VibrationEffect.DEFAULT_AMPLITUDE));
            }
            Intent intent = CaptureManager.resultIntent(result, null);
            intent.putExtra(EXTRA_MODE, mode.value);
            setResult(RESULT_OK, intent);
            finish();
        }
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(false);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightNavigationBars(false);
        setContentView(R.layout.activity_scanner);
        ViewCompat.setAccessibilityHeading(findViewById(R.id.scanner_title), true);
        View root = findViewById(R.id.scanner_root);
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            androidx.core.graphics.Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });
        ViewCompat.requestApplyInsets(root);
        preview = findViewById(R.id.scanner_preview);
        viewfinder = findViewById(R.id.scanner_viewfinder);
        viewfinder.bind(preview);
        preview.addStateListener(new CameraPreview.StateListener() {
            @Override public void previewSized() { viewfinder.invalidate(); }
            @Override public void previewStarted() { viewfinder.invalidate(); }
            @Override public void previewStopped() { viewfinder.invalidate(); }
            @Override public void cameraClosed() { }
            @Override public void cameraError(Exception error) { cancel("CAMERA_UNAVAILABLE"); }
        });
        flash = findViewById(R.id.scanner_flash);
        boolean hasFlash = getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_FLASH);
        flash.setEnabled(hasFlash);
        if (!hasFlash) { flash.setAlpha(0.4f); flash.setContentDescription(getString(R.string.scanner_flash_unavailable)); }
        flash.setOnClickListener(view -> setTorch(!torchOn));
        findViewById(R.id.scanner_back).setOnClickListener(view -> cancel(null));
        findViewById(R.id.scanner_qr).setOnClickListener(view -> selectMode(ScannerPolicy.Mode.QR));
        findViewById(R.id.scanner_auto).setOnClickListener(view -> selectMode(ScannerPolicy.Mode.AUTO));
        findViewById(R.id.scanner_barcode).setOnClickListener(view -> selectMode(ScannerPolicy.Mode.BARCODE));
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { cancel(null); }
        });
        mode = ScannerPolicy.Mode.fromValue(state == null ? null : state.getString(EXTRA_MODE));
        torchOn = state != null && state.getBoolean("torchOn", false) && hasFlash;
        applyMode();
        setTorch(torchOn);
    }

    private void selectMode(ScannerPolicy.Mode next) {
        if (returned || next == mode) return;
        mode = next;
        // ZXing calculates its crop at camera startup; reopen to apply the new shape to decoding too.
        preview.stopDecoding();
        if (resumed) preview.pauseAndWait();
        applyMode();
        if (resumed) startCamera();
    }

    private void applyMode() {
        preview.setMode(mode);
        preview.setDecoderFactory(new DefaultDecoderFactory(mode.formats()));
        boolean qr = mode != ScannerPolicy.Mode.BARCODE;
        ((TextView) findViewById(R.id.scanner_title)).setText(qr ? R.string.scanner_qr_title : R.string.scanner_barcode_title);
        ((TextView) findViewById(R.id.scanner_subtitle)).setText(qr ? R.string.scanner_qr_subtitle : R.string.scanner_barcode_subtitle);
        ((TextView) findViewById(R.id.scanner_hint)).setText(qr ? R.string.scanner_qr_hint : R.string.scanner_barcode_hint);
        Button qrButton = findViewById(R.id.scanner_qr), barcodeButton = findViewById(R.id.scanner_barcode);
        Button autoButton=findViewById(R.id.scanner_auto);autoButton.setSelected(mode==ScannerPolicy.Mode.AUTO);autoButton.setTextColor(mode==ScannerPolicy.Mode.AUTO?0xff171a20:0xffaab1bd);
        qrButton.setSelected(mode==ScannerPolicy.Mode.QR); barcodeButton.setSelected(!qr);
        qrButton.setTextColor(mode==ScannerPolicy.Mode.QR ? 0xff171a20 : 0xffaab1bd);
        barcodeButton.setTextColor(qr ? 0xffaab1bd : 0xff171a20);
        viewfinder.invalidate();
    }

    private void startCamera() {
        if (returned) return;
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            cancel("PERMISSION_DENIED"); return;
        }
        preview.decodeContinuous(callback);
        preview.resume();
        preview.setTorch(torchOn);
    }

    private void setTorch(boolean on) {
        torchOn = on;
        preview.setTorch(on);
        flash.setSelected(on);
        if (flash.isEnabled()) flash.setContentDescription(getString(on ? R.string.scanner_flash_off : R.string.scanner_flash_on));
    }

    private void cancel(String error) {
        if (returned) return;
        returned = true;
        Intent intent = new Intent().putExtra(EXTRA_MODE, mode.value);
        if (error != null) intent.putExtra(EXTRA_ERROR, error);
        setResult(RESULT_CANCELED, intent);
        finish();
    }

    @Override protected void onResume() { super.onResume(); resumed = true; startCamera(); }
    @Override protected void onPause() {
        resumed = false;
        if (preview != null) { preview.setTorch(false); preview.pauseAndWait(); }
        super.onPause();
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        state.putString(EXTRA_MODE, mode.value); state.putBoolean("torchOn", torchOn);
        super.onSaveInstanceState(state);
    }
    @Override public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP && flash.isEnabled()) { setTorch(true); return true; }
        if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN && flash.isEnabled()) { setTorch(false); return true; }
        return super.onKeyDown(keyCode, event);
    }
}
