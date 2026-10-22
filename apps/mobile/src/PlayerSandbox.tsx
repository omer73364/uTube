import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { playerResult } from "./domain";

// Player scripts get no filesystem/native APIs and cannot make network requests.
const html = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; connect-src 'none'; img-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"><script>
window.__evaluate = function(id, script) {
  try {
    var value;
    try { value = (0, eval)(script); }
    catch (error) {
      if (error instanceof SyntaxError && /Illegal return/.test(error.message)) value = (new Function(script))();
      else throw error;
    }
    window.ReactNativeWebView.postMessage(JSON.stringify({id: id, value: value}));
  } catch (error) { window.ReactNativeWebView.postMessage(JSON.stringify({id: id, error: 'PLAYER_SCRIPT_FAILED'})); }
};
</script>`;
export type PlayerEvaluator = {
  evaluate(script: string): Promise<Record<string, string>>;
};
export const PlayerSandbox = forwardRef<PlayerEvaluator>((_, ref) => {
  const web = useRef<WebView<{}>>(null);
  const pending = useRef(
    new Map<
      string,
      {
        resolve(value: Record<string, string>): void;
        reject(error: Error): void;
        timer: ReturnType<typeof setTimeout>;
      }
    >(),
  );
  const sequence = useRef(0);
  const ready = useRef(false);
  const [generation, setGeneration] = useState(0);
  function rejectPending() {
    ready.current = false;
    for (const request of pending.current.values()) {
      clearTimeout(request.timer);
      request.reject(new Error("PLAYER_SCRIPT_FAILED"));
    }
    pending.current.clear();
  }
  useEffect(() => () => rejectPending(), []);
  useImperativeHandle(
    ref,
    () => ({
      evaluate(script) {
        if (!ready.current || script.length > 1024 * 1024)
          return Promise.reject(new Error("PLAYER_NOT_READY"));
        return new Promise((resolve, reject) => {
          const id = String(++sequence.current);
          const timer = setTimeout(() => {
            pending.current.delete(id);
            reject(new Error("PLAYER_TIMEOUT"));
            ready.current = false;
            setGeneration((value) => value + 1);
          }, 5000);
          pending.current.set(id, { resolve, reject, timer });
          web.current?.injectJavaScript(
            `window.__evaluate(${JSON.stringify(id)}, ${JSON.stringify(script)}); true;`,
          );
        });
      },
    }),
    [],
  );
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        height: 1,
        width: 1,
        overflow: "hidden",
        position: "absolute",
        opacity: 0,
      }}
    >
      <WebView<{}>
        key={generation}
        ref={web}
        source={{ html }}
        originWhitelist={["about:blank"]}
        javaScriptEnabled
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        mixedContentMode="never"
        incognito
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
        javaScriptCanOpenWindowsAutomatically={false}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(request) =>
          request.url === "about:blank"
        }
        onLoadEnd={() => {
          ready.current = true;
        }}
        onRenderProcessGone={() => {
          rejectPending();
          setGeneration((value) => value + 1);
        }}
        onMessage={(event) => {
          try {
            const message = playerResult(event.nativeEvent.data);
            const request = pending.current.get(message.id);
            if (!request) return;
            clearTimeout(request.timer);
            pending.current.delete(message.id);
            if (message.error) request.reject(new Error(message.error));
            else request.resolve(message.value!);
          } catch {
            /* Discard unrecognized messages from the isolated renderer. */
          }
        }}
      />
    </View>
  );
});
