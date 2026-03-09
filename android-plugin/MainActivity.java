package ru.studyfay.app;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private RuStoreBillingPlugin billingPlugin;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getBridge().getWebView().post(() -> {
            WebView webView = getBridge().getWebView();
            billingPlugin = new RuStoreBillingPlugin(this);
            webView.addJavascriptInterface(billingPlugin, "RuStoreBilling");
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }
}
