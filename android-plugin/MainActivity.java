package ru.studyfay.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getBridge().getWebView().post(() -> {
            WebView webView = getBridge().getWebView();
            RuStoreBillingPlugin billingPlugin = new RuStoreBillingPlugin(this);
            webView.addJavascriptInterface(billingPlugin, "RuStoreBilling");
        });
    }
}
