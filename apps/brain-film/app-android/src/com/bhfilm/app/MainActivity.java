package com.bhfilm.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

/**
 * 脑洞放映厅 · 安卓壳
 *  · 填一个"教室服务器地址"(电脑上 python server.py 打印的那个),就等于是手机上装了个 App
 *  · 连不上就用内置的离线网页顶住(照样能抽卡、讲想法、走流程)
 */
public class MainActivity extends Activity {
    private WebView web;
    private TextView bar;
    private SharedPreferences sp;
    private static final String KEY_SERVER = "server_url";
    private static final String FIRST_SERVER = "http://10.55.220.62:8765";   /* 打包时电脑的局域网地址 */

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        sp = getSharedPreferences("bh", MODE_PRIVATE);

        FrameLayout root = new FrameLayout(this);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                 /* 游戏要 localStorage 存草稿/作品 */
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMediaPlaybackRequiresUserGesture(false); /* 让影片/配音能自动播 */
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        web.setBackgroundColor(Color.parseColor("#f6f4fd"));
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) goOffline("连不上教室服务器,先用离线模式");
            }
            @Override
            public void onPageFinished(WebView v, String url) {
                if (url != null && url.startsWith("http")) { bar.setVisibility(View.GONE); }
            }
        });
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));

        bar = new TextView(this);
        bar.setBackgroundColor(Color.parseColor("#6c5ce7"));
        bar.setTextColor(Color.WHITE);
        bar.setTextSize(13f);
        bar.setPadding(24, 22, 24, 22);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setText("离线模式 · 点这里填教室服务器地址");
        bar.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) { askServer(); }
        });
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(-1, -2, Gravity.TOP);
        root.addView(bar, lp);

        setContentView(root);

        String url = sp.getString(KEY_SERVER, "");
        if (url.length() == 0) { askServer(); goOffline(null); }
        else { web.loadUrl(url); }
    }

    private void goOffline(String tip) {
        web.loadUrl("file:///android_asset/index.html");
        bar.setVisibility(View.VISIBLE);
        bar.setText("离线模式 · 点这里填教室服务器地址");
        if (tip != null) Toast.makeText(this, tip, Toast.LENGTH_LONG).show();
    }

    /** 填/改教室服务器地址(电脑上启动服务器时打印的那个 http://192.168.x.x:8765) */
    private void askServer() {
        final EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        input.setHint(FIRST_SERVER);
        String cur = sp.getString(KEY_SERVER, "");
        input.setText(cur.length() > 0 ? cur : FIRST_SERVER);
        new AlertDialog.Builder(this)
            .setTitle("教室服务器地址")
            .setMessage("在电脑上双击「启动手机模式.cmd」,把它打印的地址填在这里(手机和电脑要连同一个 Wi-Fi)。")
            .setView(input)
            .setPositiveButton("连上试试", (d, w) -> {
                String u = input.getText().toString().trim();
                if (u.length() == 0) { goOffline(null); return; }
                if (!u.startsWith("http")) u = "http://" + u;
                sp.edit().putString(KEY_SERVER, u).apply();
                web.loadUrl(u);
            })
            .setNeutralButton("先用离线版", (d, w) -> goOffline(null))
            .show();
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
}
