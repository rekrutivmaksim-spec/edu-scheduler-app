package ru.studyfay.app;

import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import ru.rustore.sdk.billingclient.RuStoreBillingClient;
import ru.rustore.sdk.billingclient.RuStoreBillingClientFactory;
import ru.rustore.sdk.billingclient.model.product.Product;
import ru.rustore.sdk.billingclient.model.purchase.PaymentResult;
import ru.rustore.sdk.billingclient.model.purchase.Purchase;
import ru.rustore.sdk.billingclient.model.purchase.PurchaseState;

import org.json.JSONObject;
import org.json.JSONArray;

import java.util.List;
import java.util.ArrayList;

public class RuStoreBillingPlugin {
    private static final String TAG = "RuStoreBilling";
    private static final String CONSOLE_ID = "your_console_id";

    private final BridgeActivity activity;
    private RuStoreBillingClient billingClient;

    public RuStoreBillingPlugin(BridgeActivity activity) {
        this.activity = activity;
        initBillingClient();
    }

    private void initBillingClient() {
        try {
            billingClient = RuStoreBillingClientFactory.INSTANCE.create(
                activity.getApplication(),
                CONSOLE_ID,
                "ru.studyfay.app",
                null,
                null
            );
            Log.d(TAG, "RuStore Billing Client initialized");
        } catch (Exception e) {
            Log.e(TAG, "Failed to init RuStore Billing: " + e.getMessage());
        }
    }

    @JavascriptInterface
    public boolean isAvailable() {
        return billingClient != null;
    }

    @JavascriptInterface
    public void purchase(String productId) {
        if (billingClient == null) {
            sendResultToWeb(false, null, productId, "Billing client not initialized");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                billingClient.purchaseProduct(productId)
                    .addOnSuccessListener(result -> {
                        if (result instanceof PaymentResult.Success) {
                            PaymentResult.Success success = (PaymentResult.Success) result;
                            Log.d(TAG, "Purchase success: " + productId);
                            confirmAndSendResult(success.getPurchaseId(), productId);
                        } else if (result instanceof PaymentResult.Cancelled) {
                            Log.d(TAG, "Purchase cancelled");
                            sendResultToWeb(false, null, productId, "Покупка отменена");
                        } else if (result instanceof PaymentResult.Failure) {
                            PaymentResult.Failure failure = (PaymentResult.Failure) result;
                            String errorMsg = failure.getThrowable() != null
                                ? failure.getThrowable().getMessage()
                                : "Ошибка покупки";
                            Log.e(TAG, "Purchase failed: " + errorMsg);
                            sendResultToWeb(false, null, productId, errorMsg);
                        }
                    })
                    .addOnFailureListener(throwable -> {
                        Log.e(TAG, "Purchase error: " + throwable.getMessage());
                        sendResultToWeb(false, null, productId, throwable.getMessage());
                    });
            } catch (Exception e) {
                Log.e(TAG, "Purchase exception: " + e.getMessage());
                sendResultToWeb(false, null, productId, e.getMessage());
            }
        });
    }

    private void confirmAndSendResult(String purchaseId, String productId) {
        billingClient.confirmPurchase(purchaseId)
            .addOnSuccessListener(v -> {
                Log.d(TAG, "Purchase confirmed: " + purchaseId);
                sendResultToWeb(true, purchaseId, productId, null);
            })
            .addOnFailureListener(throwable -> {
                Log.e(TAG, "Confirm failed, still sending token: " + throwable.getMessage());
                sendResultToWeb(true, purchaseId, productId, null);
            });
    }

    @JavascriptInterface
    public String getProducts(String productIdsJson) {
        return "[]";
    }

    @JavascriptInterface
    public String getPurchases() {
        return "[]";
    }

    @JavascriptInterface
    public void confirmPurchase(String purchaseId) {
        if (billingClient == null) return;
        billingClient.confirmPurchase(purchaseId);
    }

    private void sendResultToWeb(boolean success, String purchaseToken, String productId, String error) {
        try {
            JSONObject result = new JSONObject();
            result.put("success", success);
            if (purchaseToken != null) result.put("purchaseToken", purchaseToken);
            if (productId != null) result.put("productId", productId);
            if (error != null) result.put("error", error);

            String js = "if(window.onRuStorePurchaseResult){window.onRuStorePurchaseResult('" +
                result.toString().replace("'", "\\'") + "')}";

            activity.runOnUiThread(() -> {
                try {
                    WebView webView = activity.getBridge().getWebView();
                    webView.evaluateJavascript(js, null);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to send result to web: " + e.getMessage());
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Failed to build result JSON: " + e.getMessage());
        }
    }
}
