package com.wordmaster.app;

import android.os.Bundle;
import android.view.View;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeSpeechPlugin.class);
        registerPlugin(NativeGoogleAuthPlugin.class);
        registerPlugin(NativeLayoutPlugin.class);
        super.onCreate(savedInstanceState);
        if (getBridge() == null) return;
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        View host = (View) getBridge().getWebView().getParent();
        host.setBackgroundColor(android.graphics.Color.parseColor("#f8fafc"));
        // One native owner for bars, cutouts and the keyboard, including Android 15/16.
        ViewCompat.setOnApplyWindowInsetsListener(host, (view, windowInsets) -> {
            Insets safe = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets keyboard = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            view.setPadding(safe.left, safe.top, safe.right, Math.max(safe.bottom, keyboard.bottom));
            // The WebView is already inside the safe rectangle: do not apply CSS insets again.
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(host);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                getBridge().getWebView().evaluateJavascript(
                    "Boolean(window.wordmasterHandleBack && window.wordmasterHandleBack())",
                    handled -> {
                        if (!"true".equals(handled)) {
                            setEnabled(false);
                            getOnBackPressedDispatcher().onBackPressed();
                            setEnabled(true);
                        }
                    }
                );
            }
        });
    }
}
