package io.github.alejandropico.lector;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
  @Override protected void onCreate(Bundle savedInstanceState) {
    registerPlugin(LectorDevicePlugin.class);
    registerPlugin(LectorSpeechPlugin.class);
    registerPlugin(LectorCastPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
