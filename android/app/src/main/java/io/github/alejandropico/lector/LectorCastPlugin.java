package io.github.alejandropico.lector;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import androidx.mediarouter.app.MediaRouteChooserDialogFragment;
import androidx.mediarouter.media.MediaRouteSelector;
import com.google.android.gms.cast.CastMediaControlIntent;
import com.google.android.gms.cast.framework.CastContext;
import com.google.android.gms.cast.framework.CastSession;
import com.google.android.gms.cast.framework.SessionManagerListener;

@CapacitorPlugin(name="LectorCast")
public class LectorCastPlugin extends Plugin {
  private static final String NAMESPACE="urn:x-cast:io.github.alejandropico.lector.audio";
  private CastContext context;
  private CastSession session;
  private boolean initialized;
  private void state(boolean connected) {
    JSObject data=new JSObject(); data.put("connected",connected);
    data.put("device",connected && session!=null && session.getCastDevice()!=null?session.getCastDevice().getFriendlyName():"");
    notifyListeners("state",data);
  }
  private void attach(CastSession value) {
    session=value;
    try { session.setMessageReceivedCallbacks(NAMESPACE,(device,namespace,message)->{
      if(message.length()>49152)return;
      try { notifyListeners("message",new JSObject(message)); } catch(Exception ignored) {}
    }); state(true); } catch(Exception error) { context.getSessionManager().endCurrentSession(true); state(false); }
  }
  private final SessionManagerListener<CastSession> listener=new SessionManagerListener<CastSession>() {
    @Override public void onSessionStarting(CastSession s) {}
    @Override public void onSessionStarted(CastSession s,String id) { attach(s); }
    @Override public void onSessionStartFailed(CastSession s,int error) { state(false); }
    @Override public void onSessionEnding(CastSession s) {}
    @Override public void onSessionEnded(CastSession s,int error) { session=null; state(false); }
    @Override public void onSessionResuming(CastSession s,String id) {}
    @Override public void onSessionResumed(CastSession s,boolean suspended) { attach(s); }
    @Override public void onSessionResumeFailed(CastSession s,int error) { session=null; state(false); }
    @Override public void onSessionSuspended(CastSession s,int reason) { session=null; state(false); }
  };
  @PluginMethod public void initialize(PluginCall call) {
    getActivity().runOnUiThread(()->{
      String id=getContext().getString(R.string.lector_cast_app_id);
      JSObject result=new JSObject();result.put("available",false);
      // Empty project configuration must never discover or launch another app.
      if(!id.matches("[A-F0-9]{8}")||id.equals("CC1AD845")){call.resolve(result);return;}
      try { if(!initialized){context=CastContext.getSharedInstance(getActivity());context.getSessionManager().addSessionManagerListener(listener,CastSession.class);initialized=true;}result.put("available",true);call.resolve(result); }
      catch(Exception error) { call.resolve(result); }
    });
  }
  @PluginMethod public void request(PluginCall call) {
    getActivity().runOnUiThread(()->{
      if(!initialized){call.reject("Google Cast unavailable");return;}
      try {
        MediaRouteSelector selector=new MediaRouteSelector.Builder().addControlCategory(CastMediaControlIntent.categoryForCast(getContext().getString(R.string.lector_cast_app_id))).build();
        MediaRouteChooserDialogFragment chooser=new MediaRouteChooserDialogFragment();chooser.setRouteSelector(selector);
        chooser.show(getActivity().getSupportFragmentManager(),"lector-cast");call.resolve();
      } catch(Exception error) { call.reject("Google Cast unavailable"); }
    });
  }
  @PluginMethod public void send(PluginCall call) {
    String message=call.getString("message","");
    if(message.length()>49152){call.reject("Message too large");return;}
    getActivity().runOnUiThread(()->{
      if(session==null||!session.isConnected()){call.reject("No Cast session");return;}
      try { session.sendMessage(NAMESPACE,message).setResultCallback(result->{if(result.isSuccess())call.resolve();else call.reject("Cast message failed");}); }
      catch(Exception error) { call.reject("Cast message failed"); }
    });
  }
  @PluginMethod public void disconnect(PluginCall call) {
    getActivity().runOnUiThread(()->{if(context!=null)context.getSessionManager().endCurrentSession(true);session=null;state(false);call.resolve();});
  }
  @Override protected void handleOnDestroy() {
    if(context!=null){context.getSessionManager().endCurrentSession(true);context.getSessionManager().removeSessionManagerListener(listener,CastSession.class);}
  }
}
