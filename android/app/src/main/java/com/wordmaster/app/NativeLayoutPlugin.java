package com.wordmaster.app;

import android.graphics.Color;
import android.app.Activity;
import android.content.Intent;
import android.view.View;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NativeLayout")
public class NativeLayoutPlugin extends Plugin {
    @PluginMethod
    public void saveTextFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mimeType", "text/plain"));
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("filename", "WordMaster.json"));
        startActivityForResult(call, intent, "fileCreated");
    }

    @ActivityCallback
    private void fileCreated(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        getBridge().execute(() -> {
            try (OutputStream stream = getActivity().getContentResolver().openOutputStream(result.getData().getData(), "wt")) {
                if (stream == null) throw new java.io.IOException("Document is not writable");
                stream.write(call.getString("content", "").getBytes(StandardCharsets.UTF_8));
                call.resolve();
            } catch (Exception error) {
                call.reject("Unable to save vocabulary", error);
            }
        });
    }

    @PluginMethod
    public void getVersion(PluginCall call) {
        try {
            String name = getContext().getPackageManager()
                .getPackageInfo(getContext().getPackageName(), 0).versionName;
            JSObject response = new JSObject();
            response.put("versionName", name);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Unable to read version", error);
        }
    }

    @PluginMethod
    public void setBackground(PluginCall call) {
        String color = call.getString("color", "#f8fafc");
        getActivity().runOnUiThread(() -> {
            try {
                View host = (View) getBridge().getWebView().getParent();
                host.setBackgroundColor(Color.parseColor(color));
                call.resolve();
            } catch (IllegalArgumentException error) {
                call.reject("Invalid surface color");
            }
        });
    }
}
