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
    // ВАЖНО: замените на ваш CONSOLE_ID из RuStore Console
    // console.rustore.ru/apps/XXXXX/versions → XXXXX = ваш ID
    private static final String CONSOLE_ID = "REPLACE_WITH_YOUR_APP_ID";
    private static final String DEEPLINK_SCHEME = "studyfay";

    private final BridgeActivity activity;
    private RuStoreBillingClient billingClient;
    private String initError = null;

    public RuStoreBillingPlugin(BridgeActivity activity) {
        this.activity = activity;
        initBillingClient();
    }

    private void initBillingClient() {
        try {
            billingClient = RuStoreBillingClientFactory.INSTANCE.create(
                activity.getApplication(),
                CONSOLE_ID,
                DEEPLINK_SCHEME,
                null,
                null
            );
            Log.d(TAG, "RuStore Billing Client initialized, consoleId=" + CONSOLE_ID);
        } catch (Exception e) {
            initError = e.getMessage();
            Log.e(TAG, "Failed to init RuStore Billing: " + e.getMessage());
        }
    }

    @JavascriptInterface
    public boolean isAvailable() {
        boolean available = billingClient != null;
        Log.d(TAG, "isAvailable=" + available + (initError != null ? " initError=" + initError : ""));
        return available;
    }

    @JavascriptInterface
    public String getInitError() {
        return initError != null ? initError : "";
    }

    @JavascriptInterface
    public void purchase(String productId) {
        Log.d(TAG, "purchase called: productId=" + productId);

        if (billingClient == null) {
            Log.e(TAG, "billingClient is null, initError=" + initError);
            sendResultToWeb(false, null, productId, "Billing client not initialized: " + initError);
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                billingClient.purchaseProduct(productId)
                    .addOnSuccessListener(result -> {
                        if (result instanceof PaymentResult.Success) {
                            PaymentResult.Success success = (PaymentResult.Success) result;
                            Log.d(TAG, "Purchase success: " + productId + " purchaseId=" + success.getPurchaseId());
                            confirmAndSendResult(success.getPurchaseId(), productId);
                        } else if (result instanceof PaymentResult.Cancelled) {
                            Log.d(TAG, "Purchase cancelled by user");
                            sendResultToWeb(false, null, productId, "Покупка отменена");
                        } else if (result instanceof PaymentResult.Failure) {
                            PaymentResult.Failure failure = (PaymentResult.Failure) result;
                            String errorMsg = failure.getThrowable() != null
                                ? failure.getThrowable().getMessage()
                                : "Ошибка покупки";
                            Log.e(TAG, "Purchase failed: " + errorMsg);
                            sendResultToWeb(false, null, productId, errorMsg);
                        } else {
                            Log.w(TAG, "Unknown PaymentResult type: " + result.getClass().getName());
                            sendResultToWeb(false, null, productId, "Неизвестный результат: " + result.getClass().getSimpleName());
                        }
                    })
                    .addOnFailureListener(throwable -> {
                        Log.e(TAG, "Purchase error: " + throwable.getMessage(), throwable);
                        sendResultToWeb(false, null, productId, throwable.getMessage());
                    });
            } catch (Exception e) {
                Log.e(TAG, "Purchase exception: " + e.getMessage(), e);
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
