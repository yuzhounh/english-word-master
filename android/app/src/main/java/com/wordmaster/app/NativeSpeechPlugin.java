package com.wordmaster.app;

import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;
import java.util.UUID;

@CapacitorPlugin(name = "NativeSpeech")
public class NativeSpeechPlugin extends Plugin {

    private TextToSpeech engine;
    private boolean initializing;
    private boolean ready;
    private PluginCall pendingCall;
    private String pendingText;
    private Locale pendingLocale;
    private float pendingRate;
    private float pendingPitch;
    private String activeUtteranceId;

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "").trim();
        if (text.isEmpty()) {
            call.reject("Text is required.");
            return;
        }

        String language = call.getString("language", "en-US");
        Double rate = call.getDouble("rate", 0.9);
        Double pitch = call.getDouble("pitch", 1.0);

        getActivity().runOnUiThread(() -> {
            interruptPending("Speech was replaced by a newer request.");
            pendingCall = call;
            pendingText = text;
            pendingLocale = Locale.forLanguageTag(language);
            pendingRate = rate.floatValue();
            pendingPitch = pitch.floatValue();

            if (ready) {
                startPendingSpeech();
            } else {
                initializeEngine();
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            interruptPending("Speech was stopped.");
            call.resolve();
        });
    }

    private void initializeEngine() {
        if (initializing || engine != null) return;
        initializing = true;
        engine = new TextToSpeech(getContext(), status -> {
            initializing = false;
            ready = status == TextToSpeech.SUCCESS;
            if (!ready) {
                if (pendingCall != null) pendingCall.reject("Android text-to-speech initialization failed.");
                clearPending();
                if (engine != null) {
                    engine.shutdown();
                    engine = null;
                }
                return;
            }

            engine.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String utteranceId) {}

                @Override
                public void onDone(String utteranceId) {
                    finishUtterance(utteranceId, null);
                }

                @Override
                public void onError(String utteranceId) {
                    finishUtterance(utteranceId, "Android text-to-speech playback failed.");
                }

                @Override
                public void onError(String utteranceId, int errorCode) {
                    finishUtterance(utteranceId, "Android text-to-speech playback failed (" + errorCode + ").");
                }

                @Override
                public void onStop(String utteranceId, boolean interrupted) {
                    finishUtterance(utteranceId, interrupted ? "Speech was interrupted." : null);
                }
            });
            startPendingSpeech();
        });
    }

    private void startPendingSpeech() {
        if (!ready || engine == null || pendingCall == null || pendingText == null) return;

        int availability = engine.setLanguage(pendingLocale);
        if (availability == TextToSpeech.LANG_MISSING_DATA || availability == TextToSpeech.LANG_NOT_SUPPORTED) {
            availability = engine.setLanguage(Locale.ENGLISH);
        }
        if (availability == TextToSpeech.LANG_MISSING_DATA || availability == TextToSpeech.LANG_NOT_SUPPORTED) {
            pendingCall.reject("No English text-to-speech voice is installed on this device.");
            clearPending();
            return;
        }

        engine.setSpeechRate(pendingRate);
        engine.setPitch(pendingPitch);
        activeUtteranceId = UUID.randomUUID().toString();
        int result = engine.speak(pendingText, TextToSpeech.QUEUE_FLUSH, null, activeUtteranceId);
        if (result == TextToSpeech.ERROR) {
            pendingCall.reject("Android text-to-speech could not start.");
            clearPending();
        }
    }

    private void finishUtterance(String utteranceId, String error) {
        getActivity().runOnUiThread(() -> {
            if (pendingCall == null || activeUtteranceId == null || !activeUtteranceId.equals(utteranceId)) return;
            if (error == null) pendingCall.resolve();
            else pendingCall.reject(error);
            clearPending();
        });
    }

    private void interruptPending(String reason) {
        if (engine != null) engine.stop();
        if (pendingCall != null) pendingCall.reject(reason);
        clearPending();
    }

    private void clearPending() {
        pendingCall = null;
        pendingText = null;
        pendingLocale = null;
        activeUtteranceId = null;
    }

    @Override
    protected void handleOnDestroy() {
        interruptPending("Speech engine was closed.");
        if (engine != null) {
            engine.shutdown();
            engine = null;
        }
        ready = false;
        super.handleOnDestroy();
    }
}
